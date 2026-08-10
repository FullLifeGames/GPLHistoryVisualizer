// Shared d3 chart helpers for line/step charts. Colors come exclusively from
// the --viz-* custom properties (via .viz-series-N { color } + currentColor),
// so light/dark themes restyle without a redraw; geometry redraws on resize.
// zeitreise.js keeps its own rendering — this module is for all newer charts.

export function paddedDomain(values = [], padRatio = 0.06) {
  const numbers = values.filter((value) => Number.isFinite(value));
  if (!numbers.length) return [0, 1];
  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  if (min === max) return [min - 1, max + 1];
  const pad = (max - min) * padRatio;
  return [min - pad, max + pad];
}

export function buildSeries(points = [], xAccessor, yAccessor) {
  const shaped = points
    .map((point) => ({ x: xAccessor(point), y: yAccessor(point), source: point }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  return {
    points: shaped,
    xDomain: shaped.length ? [Math.min(...shaped.map((p) => p.x)), Math.max(...shaped.map((p) => p.x))] : [0, 1],
    yDomain: paddedDomain(shaped.map((point) => point.y)),
  };
}

const DEFAULT_HEIGHT = 300;
const MARGIN = { top: 16, right: 18, bottom: 30, left: 48 };

function cleanupContainer(container) {
  if (typeof container.__chartCleanup === "function") container.__chartCleanup();
  container.__chartCleanup = null;
  container.replaceChildren();
}

export function lineChart(container, config = {}) {
  return renderChart(container, config, "line");
}

export function stepChart(container, config = {}) {
  return renderChart(container, config, "step");
}

function renderChart(container, config, kind) {
  cleanupContainer(container);
  const d3 = window.d3;
  if (!container || !d3) {
    if (container) {
      const note = document.createElement("p");
      note.className = "chart-fallback";
      note.textContent = config.fallbackText || "";
      container.appendChild(note);
    }
    return { redraw() {}, destroy() {} };
  }

  let layoutRetries = 0;
  const draw = () => {
    container.classList.add("chart-host");

    // A draw at unmeasured width would bake a tiny viewBox that CSS then
    // stretches into blurry, oversized text. Wait for layout instead.
    const measured = container.getBoundingClientRect().width;
    if (!measured && layoutRetries < 30) {
      layoutRetries += 1;
      requestAnimationFrame(draw);
      return;
    }
    layoutRetries = 0;
    container.replaceChildren();

    const width = Math.max(Math.round(measured) || 0, 320);
    const height = config.height || DEFAULT_HEIGHT;
    const innerWidth = width - MARGIN.left - MARGIN.right;
    const innerHeight = height - MARGIN.top - MARGIN.bottom;

    const seriesList = (config.series || []).filter((series) => (series.points || []).length);
    const allPoints = seriesList.flatMap((series) => series.points);
    const xDomain = config.xDomain || [
      Math.min(...allPoints.map((p) => p.x), 0),
      Math.max(...allPoints.map((p) => p.x), 1),
    ];
    const yDomain = config.yDomain || paddedDomain(allPoints.map((p) => p.y));

    const x = d3.scaleLinear().domain(xDomain).range([0, innerWidth]);
    const y = d3.scaleLinear().domain(yDomain).range([innerHeight, 0]);

    const svg = d3
      .select(container)
      .append("svg")
      .attr("class", `chart chart-kind-${kind}`)
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("role", "img");
    const root = svg.append("g").attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    for (const band of config.bands || []) {
      const fromX = Math.max(x(band.fromX), 0);
      const toX = Math.min(x(band.toX), innerWidth);
      if (!(toX > fromX)) continue;
      root
        .append("rect")
        .attr("class", `chart-band ${band.className || ""}`.trim())
        .attr("x", fromX)
        .attr("y", 0)
        .attr("width", toX - fromX)
        .attr("height", innerHeight);
    }

    const yTicks = y.ticks(5);
    const grid = root.append("g").attr("class", "chart-grid");
    for (const tick of yTicks) {
      grid
        .append("line")
        .attr("x1", 0)
        .attr("x2", innerWidth)
        .attr("y1", y(tick))
        .attr("y2", y(tick));
    }

    const formatX = config.formatX || ((value) => String(value));
    const formatY = config.formatY || ((value) => String(Math.round(value)));
    const xAxis = d3.axisBottom(x).ticks(Math.min(8, innerWidth / 80)).tickFormat(formatX);
    const yAxis = d3.axisLeft(y).tickValues(yTicks).tickFormat(formatY);
    root.append("g").attr("class", "chart-axis chart-axis-x").attr("transform", `translate(0,${innerHeight})`).call(xAxis);
    root.append("g").attr("class", "chart-axis chart-axis-y").call(yAxis);

    const lineShape = d3
      .line()
      .x((point) => x(point.x))
      .y((point) => y(point.y))
      .curve(kind === "step" ? d3.curveStepAfter : d3.curveMonotoneX);

    seriesList.forEach((series, index) => {
      root
        .append("path")
        .attr("class", `chart-line ${series.className || `viz-series-${(index % 8) + 1}`}`)
        .attr("d", lineShape(series.points));
    });

    for (const marker of config.markers || []) {
      const markerGroup = root
        .append("g")
        .attr("class", `chart-marker ${marker.className || ""}`.trim())
        .attr("transform", `translate(${x(marker.x)},${y(marker.y)})`);
      markerGroup.append("circle").attr("r", 5);
      if (marker.title) markerGroup.append("title").text(marker.title);
    }

    // Labels live in their own top layer so the Elo line never strikes
    // through the text; a surface-colored halo (CSS paint-order) keeps them
    // readable over bands, grid, and line alike.
    const labelLayer = root.append("g").attr("class", "chart-label-layer");
    for (const band of config.bands || []) {
      const fromX = Math.max(x(band.fromX), 0);
      const toX = Math.min(x(band.toX), innerWidth);
      if (!(toX > fromX) || !band.label) continue;
      const available = toX - fromX - 8;
      const text = labelLayer
        .append("text")
        .attr("class", "chart-band-label")
        .attr("x", fromX + 4)
        .attr("y", 14)
        .text(band.label);
      // Neighboring bands share one label row; a label wider than its own
      // band bleeds into the next one, so degrade to the short form or drop.
      if (text.node().getComputedTextLength() > available) {
        text.text(band.shortLabel || "");
        if (!band.shortLabel || text.node().getComputedTextLength() > available) {
          text.remove();
          continue;
        }
      }
      text.append("title").text(band.label);
    }
    for (const marker of config.markers || []) {
      if (!marker.label) continue;
      const text = labelLayer
        .append("text")
        .attr("class", `chart-marker-label ${marker.className || ""}`.trim())
        .attr("text-anchor", "middle")
        .text(marker.label);
      if (marker.labelAt === "top") {
        const clampedX = Math.min(Math.max(x(marker.x), 50), innerWidth - 50);
        text.attr("x", clampedX).attr("y", 32);
      } else {
        text.attr("x", x(marker.x)).attr("y", y(marker.y) - 9);
      }
    }

    if (config.onHover || config.tooltip) {
      const tooltip = document.createElement("div");
      tooltip.className = "chart-tooltip";
      tooltip.hidden = true;
      container.appendChild(tooltip);
      const focus = root.append("circle").attr("class", "chart-focus").attr("r", 4).style("display", "none");

      const nearestPoint = (mouseX) => {
        let best = null;
        let bestDistance = Infinity;
        for (const series of seriesList) {
          for (const point of series.points) {
            const distance = Math.abs(x(point.x) - mouseX);
            if (distance < bestDistance) {
              bestDistance = distance;
              best = { point, series };
            }
          }
        }
        return best;
      };

      root
        .append("rect")
        .attr("class", "chart-hover-surface")
        .attr("width", innerWidth)
        .attr("height", innerHeight)
        .attr("fill", "transparent")
        .on("mousemove", (event) => {
          const [mouseX] = d3.pointer(event);
          const best = nearestPoint(mouseX);
          if (!best) return;
          focus
            .style("display", null)
            .attr("class", `chart-focus ${best.series.className || ""}`.trim())
            .attr("cx", x(best.point.x))
            .attr("cy", y(best.point.y));
          const text = config.tooltip ? config.tooltip(best.point.source, best.series) : "";
          if (text) {
            tooltip.hidden = false;
            tooltip.textContent = text;
            const left = Math.min(Math.max(x(best.point.x) + MARGIN.left, 40), width - 40);
            tooltip.style.left = `${(left / width) * 100}%`;
            tooltip.style.top = `${((y(best.point.y) + MARGIN.top) / height) * 100}%`;
          }
          if (config.onHover) config.onHover(best.point.source, best.series);
        })
        .on("mouseleave", () => {
          focus.style("display", "none");
          tooltip.hidden = true;
          if (config.onHover) config.onHover(null, null);
        });
    }
  };

  draw();

  let resizeTimer = null;
  const resizeObserver = new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(draw, 120);
  });
  resizeObserver.observe(container);

  const destroy = () => {
    clearTimeout(resizeTimer);
    resizeObserver.disconnect();
    container.__chartCleanup = null;
  };
  container.__chartCleanup = destroy;
  return { redraw: draw, destroy };
}
