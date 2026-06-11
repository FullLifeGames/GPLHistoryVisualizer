from gpl_history.playlists import group_gpl_playlists, is_gpl_playlist, parse_gpl_season_number


def test_is_gpl_playlist_accepts_german_pokemon_league_and_gpl_titles():
    assert is_gpl_playlist({"title": "German Pokémon League - PresentLP"})
    assert is_gpl_playlist({"title": "GPL [S4] - PresentLP"})
    assert is_gpl_playlist({"title": "Alle GPL S8 Kämpfe - Liga 1 & Liga 2!"})


def test_is_gpl_playlist_rejects_other_league_abbreviations():
    assert not is_gpl_playlist({"title": "Meme Pokémon League [MPL] - Season 3"})
    assert not is_gpl_playlist({"title": "BRL - Battle Revolution League [S1]"})
    assert not is_gpl_playlist({"title": "SML [S6]"})


def test_parse_gpl_season_number_handles_known_title_shapes():
    assert parse_gpl_season_number("German Pokémon League - PresentLP") == 1
    assert parse_gpl_season_number("German Pokémon League - Alle Kämpfe") == 1
    assert parse_gpl_season_number("GPL [S2] - PresentLP") == 2
    assert parse_gpl_season_number("Infos zu GPL S3!") == 3
    assert parse_gpl_season_number("German Pokémon League [GPL] - Season 8 - Present") == 8
    assert parse_gpl_season_number("Alle GPL S8 Kämpfe - Liga 1 & Liga 2!") == 8
    assert parse_gpl_season_number("GPL Season 10 - ALLE KÄMPFE") == 10


def test_group_gpl_playlists_groups_multiple_playlists_by_season():
    playlists = [
        {"playlistId": "not", "title": "Pokemon Rot", "publishedAt": "2013-01-01T00:00:00Z"},
        {"playlistId": "s1a", "title": "German Pokémon League - PresentLP", "publishedAt": "2014-01-01T00:00:00Z"},
        {"playlistId": "s1b", "title": "German Pokémon League - Alle Kämpfe", "publishedAt": "2014-01-02T00:00:00Z"},
        {"playlistId": "s2", "title": "GPL [S2] - PresentLP", "publishedAt": "2015-01-01T00:00:00Z"},
    ]

    groups = group_gpl_playlists(playlists)

    assert [group["season_number"] for group in groups] == [1, 2]
    assert [playlist["playlistId"] for playlist in groups[0]["playlists"]] == ["s1a", "s1b"]
    assert [playlist["playlistId"] for playlist in groups[1]["playlists"]] == ["s2"]
