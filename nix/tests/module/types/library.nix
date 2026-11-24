{
  lib,
  assertEq,
  assertThrows,
  assertSucceeds,
  ...
}: let
  types = import ../../../module/types {inherit lib;};
  inherit (types.library) mkLibraryConfig;

  nullConfig = {virtualFolders = null;};
in [
  (assertEq "renameFrom is emitted and null is omitted" (let
    folder = name: renameFrom: {
      inherit name renameFrom;
      collectionType = "movies";
      ignoreChanges = [];
      libraryOptions = {pathInfos = [{path = "/m";}];};
    };
    out = mkLibraryConfig {
      virtualFolders = [(folder "Movies" "Films") (folder "Shows" null)];
    };
  in
    map (f: f.renameFrom or null) out.virtualFolders) ["Films" null])

  (assertEq "ignoreChanges is emitted" (mkLibraryConfig {
      virtualFolders = [
        {
          name = "Anime";
          collectionType = "tvshows";
          libraryOptions.pathInfos = [{path = "/data/anime";}];
          ignoreChanges = ["pathInfos"];
        }
      ];
    })
    {
      virtualFolders = [
        {
          name = "Anime";
          collectionType = "tvshows";
          libraryOptions.pathInfos = [{path = "/data/anime";}];
          ignoreChanges = ["pathInfos"];
        }
      ];
    })

  (assertSucceeds "ignoreChanges accepts every library option" (let
    folder = names:
      lib.evalModules {
        modules = [
          {
            options.f = lib.mkOption {type = types.library.libraryConfigType;};
            config.f.virtualFolders = [
              {
                name = "x";
                collectionType = "movies";
                libraryOptions.pathInfos = [{path = "/x";}];
                ignoreChanges = names;
              }
            ];
          }
        ];
      };
  in
    (folder ["pathInfos" "enableRealtimeMonitor" "typeOptions"]).config.f))

  (assertThrows "ignoreChanges rejects unknown option" (let
    r = lib.evalModules {
      modules = [
        {
          options.f = lib.mkOption {type = types.library.libraryConfigType;};
          config.f.virtualFolders = [
            {
              name = "x";
              collectionType = "movies";
              libraryOptions.pathInfos = [{path = "/x";}];
              ignoreChanges = ["bogus"];
            }
          ];
        }
      ];
    };
  in
    r.config.f))

  (assertEq "empty config" (mkLibraryConfig nullConfig) {})

  (assertEq "valid virtual folder" (mkLibraryConfig {
      virtualFolders = [
        {
          name = "Movies";
          collectionType = "movies";
          libraryOptions = {
            pathInfos = [{path = "/data/movies";}];
          };
        }
      ];
    }) {
      virtualFolders = [
        {
          name = "Movies";
          collectionType = "movies";
          libraryOptions = {
            pathInfos = [{path = "/data/movies";}];
          };
        }
      ];
    })

  (assertEq "multiple paths" (mkLibraryConfig {
      virtualFolders = [
        {
          name = "Movies";
          collectionType = "movies";
          libraryOptions = {
            pathInfos = [{path = "/data/movies";} {path = "/data/movies2";}];
          };
        }
      ];
    }) {
      virtualFolders = [
        {
          name = "Movies";
          collectionType = "movies";
          libraryOptions = {
            pathInfos = [{path = "/data/movies";} {path = "/data/movies2";}];
          };
        }
      ];
    })

  (assertEq "multiple virtual folders" (mkLibraryConfig {
      virtualFolders = [
        {
          name = "Movies";
          collectionType = "movies";
          libraryOptions = {pathInfos = [{path = "/data/movies";}];};
        }
        {
          name = "TV Shows";
          collectionType = "tvshows";
          libraryOptions = {pathInfos = [{path = "/data/shows";}];};
        }
      ];
    }) {
      virtualFolders = [
        {
          name = "Movies";
          collectionType = "movies";
          libraryOptions = {pathInfos = [{path = "/data/movies";}];};
        }
        {
          name = "TV Shows";
          collectionType = "tvshows";
          libraryOptions = {pathInfos = [{path = "/data/shows";}];};
        }
      ];
    })

  (assertEq "collectionType movies" (mkLibraryConfig {
      virtualFolders = [
        {
          name = "Test";
          collectionType = "movies";
          libraryOptions = {pathInfos = [{path = "/test";}];};
        }
      ];
    }) {
      virtualFolders = [
        {
          name = "Test";
          collectionType = "movies";
          libraryOptions = {pathInfos = [{path = "/test";}];};
        }
      ];
    })

  (assertEq "collectionType tvshows" (mkLibraryConfig {
      virtualFolders = [
        {
          name = "Test";
          collectionType = "tvshows";
          libraryOptions = {pathInfos = [{path = "/test";}];};
        }
      ];
    }) {
      virtualFolders = [
        {
          name = "Test";
          collectionType = "tvshows";
          libraryOptions = {pathInfos = [{path = "/test";}];};
        }
      ];
    })

  (assertEq "collectionType music" (mkLibraryConfig {
      virtualFolders = [
        {
          name = "Test";
          collectionType = "music";
          libraryOptions = {pathInfos = [{path = "/test";}];};
        }
      ];
    }) {
      virtualFolders = [
        {
          name = "Test";
          collectionType = "music";
          libraryOptions = {pathInfos = [{path = "/test";}];};
        }
      ];
    })

  (assertEq "collectionType musicvideos" (mkLibraryConfig {
      virtualFolders = [
        {
          name = "Test";
          collectionType = "musicvideos";
          libraryOptions = {pathInfos = [{path = "/test";}];};
        }
      ];
    }) {
      virtualFolders = [
        {
          name = "Test";
          collectionType = "musicvideos";
          libraryOptions = {pathInfos = [{path = "/test";}];};
        }
      ];
    })

  (assertEq "collectionType homevideos" (mkLibraryConfig {
      virtualFolders = [
        {
          name = "Test";
          collectionType = "homevideos";
          libraryOptions = {pathInfos = [{path = "/test";}];};
        }
      ];
    }) {
      virtualFolders = [
        {
          name = "Test";
          collectionType = "homevideos";
          libraryOptions = {pathInfos = [{path = "/test";}];};
        }
      ];
    })

  (assertEq "collectionType boxsets" (mkLibraryConfig {
      virtualFolders = [
        {
          name = "Test";
          collectionType = "boxsets";
          libraryOptions = {pathInfos = [{path = "/test";}];};
        }
      ];
    }) {
      virtualFolders = [
        {
          name = "Test";
          collectionType = "boxsets";
          libraryOptions = {pathInfos = [{path = "/test";}];};
        }
      ];
    })

  (assertEq "collectionType books" (mkLibraryConfig {
      virtualFolders = [
        {
          name = "Test";
          collectionType = "books";
          libraryOptions = {pathInfos = [{path = "/test";}];};
        }
      ];
    }) {
      virtualFolders = [
        {
          name = "Test";
          collectionType = "books";
          libraryOptions = {pathInfos = [{path = "/test";}];};
        }
      ];
    })

  (assertEq "collectionType mixed" (mkLibraryConfig {
      virtualFolders = [
        {
          name = "Test";
          collectionType = "mixed";
          libraryOptions = {pathInfos = [{path = "/test";}];};
        }
      ];
    }) {
      virtualFolders = [
        {
          name = "Test";
          collectionType = "mixed";
          libraryOptions = {pathInfos = [{path = "/test";}];};
        }
      ];
    })

  (assertEq "typeOptions are mapped when provided" (mkLibraryConfig {
      virtualFolders = [
        {
          name = "Movies";
          collectionType = "movies";
          libraryOptions = {
            pathInfos = [{path = "/data/movies";}];
            typeOptions = [
              {
                type = "Movie";
                metadataFetchers = ["TheMovieDB"];
                imageFetchers = ["TheMovieDB"];
              }
            ];
            automaticallyAddToCollection = true;
            enableChapterImageExtraction = true;
            extractChapterImagesDuringLibraryScan = true;
            extractTrickplayImagesDuringLibraryScan = true;
            enableEmbeddedEpisodeInfos = true;
            enableEmbeddedExtraTitles = true;
            enableTrickplayImageExtraction = true;
            saveTrickplayWithMedia = true;
            metadataSavers = ["Nfo"];
            saveLocalMetadata = true;
            automaticRefreshIntervalDays = 14;
            enableRealtimeMonitor = true;
            enabled = true;
            enablePhotos = false;
            enableLUFSScan = true;
            enableAutomaticSeriesGrouping = false;
            enableEmbeddedTitles = true;
            skipSubtitlesIfEmbeddedSubtitlesPresent = false;
            skipSubtitlesIfAudioTrackMatches = true;
            requirePerfectSubtitleMatch = false;
            saveSubtitlesWithMedia = true;
            saveLyricsWithMedia = false;
            preferNonstandardArtistsTag = true;
            useCustomTagDelimiters = false;
            preferredMetadataLanguage = "en";
            metadataCountryCode = "US";
            seasonZeroDisplayName = "Specials";
            allowEmbeddedSubtitles = "AllowText";
            disabledLocalMetadataReaders = ["Emby Nfo"];
            localMetadataReaderOrder = ["Nfo" "TheMovieDB"];
            disabledSubtitleFetchers = ["OpenSubtitles"];
            subtitleFetcherOrder = ["Subscene"];
            disabledMediaSegmentProviders = [];
            mediaSegmentProviderOrder = ["Jellyfin Segment Provider"];
            subtitleDownloadLanguages = ["eng" "fra"];
            disabledLyricFetchers = [];
            lyricFetcherOrder = ["LrcLib"];
            customTagDelimiters = ["/"];
            delimiterWhitelist = [";"];
          };
        }
      ];
    }) {
      virtualFolders = [
        {
          name = "Movies";
          collectionType = "movies";
          libraryOptions = {
            pathInfos = [{path = "/data/movies";}];
            typeOptions = [
              {
                type = "Movie";
                metadataFetchers = ["TheMovieDB"];
                metadataFetcherOrder = ["TheMovieDB"];
                imageFetchers = ["TheMovieDB"];
                imageFetcherOrder = ["TheMovieDB"];
              }
            ];
            automaticallyAddToCollection = true;
            enableChapterImageExtraction = true;
            extractChapterImagesDuringLibraryScan = true;
            extractTrickplayImagesDuringLibraryScan = true;
            enableEmbeddedEpisodeInfos = true;
            enableEmbeddedExtraTitles = true;
            enableTrickplayImageExtraction = true;
            saveTrickplayWithMedia = true;
            metadataSavers = ["Nfo"];
            saveLocalMetadata = true;
            automaticRefreshIntervalDays = 14;
            enableRealtimeMonitor = true;
            enabled = true;
            enablePhotos = false;
            enableLUFSScan = true;
            enableAutomaticSeriesGrouping = false;
            enableEmbeddedTitles = true;
            skipSubtitlesIfEmbeddedSubtitlesPresent = false;
            skipSubtitlesIfAudioTrackMatches = true;
            requirePerfectSubtitleMatch = false;
            saveSubtitlesWithMedia = true;
            saveLyricsWithMedia = false;
            preferNonstandardArtistsTag = true;
            useCustomTagDelimiters = false;
            preferredMetadataLanguage = "en";
            metadataCountryCode = "US";
            seasonZeroDisplayName = "Specials";
            allowEmbeddedSubtitles = "AllowText";
            disabledLocalMetadataReaders = ["Emby Nfo"];
            localMetadataReaderOrder = ["Nfo" "TheMovieDB"];
            disabledSubtitleFetchers = ["OpenSubtitles"];
            subtitleFetcherOrder = ["Subscene"];
            disabledMediaSegmentProviders = [];
            mediaSegmentProviderOrder = ["Jellyfin Segment Provider"];
            subtitleDownloadLanguages = ["eng" "fra"];
            disabledLyricFetchers = [];
            lyricFetcherOrder = ["LrcLib"];
            customTagDelimiters = ["/"];
            delimiterWhitelist = [";"];
          };
        }
      ];
    })

  (assertEq "typeOptions orders fallback when null" (mkLibraryConfig {
      virtualFolders = [
        {
          name = "Movies";
          collectionType = "movies";
          libraryOptions = {
            pathInfos = [{path = "/data/movies";}];
            typeOptions = [
              {
                type = "Movie";
                metadataFetchers = ["TheMovieDB"];
                metadataFetcherOrder = null;
                imageFetchers = ["TheMovieDB"];
                imageFetcherOrder = null;
              }
            ];
          };
        }
      ];
    }) {
      virtualFolders = [
        {
          name = "Movies";
          collectionType = "movies";
          libraryOptions = {
            pathInfos = [{path = "/data/movies";}];
            typeOptions = [
              {
                type = "Movie";
                metadataFetchers = ["TheMovieDB"];
                metadataFetcherOrder = ["TheMovieDB"];
                imageFetchers = ["TheMovieDB"];
                imageFetcherOrder = ["TheMovieDB"];
              }
            ];
          };
        }
      ];
    })

  (assertEq "typeOptions similarItemProviders with order fallback" (mkLibraryConfig {
      virtualFolders = [
        {
          name = "Movies";
          collectionType = "movies";
          libraryOptions = {
            pathInfos = [{path = "/data/movies";}];
            typeOptions = [
              {
                type = "Movie";
                metadataFetchers = ["TheMovieDB"];
                metadataFetcherOrder = null;
                imageFetchers = ["TheMovieDB"];
                imageFetcherOrder = null;
                similarItemProviders = ["Local" "Tmdb"];
                similarItemProviderOrder = null;
              }
            ];
          };
        }
      ];
    }) {
      virtualFolders = [
        {
          name = "Movies";
          collectionType = "movies";
          libraryOptions = {
            pathInfos = [{path = "/data/movies";}];
            typeOptions = [
              {
                type = "Movie";
                metadataFetchers = ["TheMovieDB"];
                metadataFetcherOrder = ["TheMovieDB"];
                imageFetchers = ["TheMovieDB"];
                imageFetcherOrder = ["TheMovieDB"];
                similarItemProviders = ["Local" "Tmdb"];
                similarItemProviderOrder = ["Local" "Tmdb"];
              }
            ];
          };
        }
      ];
    })

  (assertEq "typeOptions similarItemProviderOrder is kept when set" (mkLibraryConfig {
      virtualFolders = [
        {
          name = "Movies";
          collectionType = "movies";
          libraryOptions = {
            pathInfos = [{path = "/data/movies";}];
            typeOptions = [
              {
                type = "Movie";
                metadataFetchers = [];
                metadataFetcherOrder = null;
                imageFetchers = [];
                imageFetcherOrder = null;
                similarItemProviders = ["Local" "Tmdb"];
                similarItemProviderOrder = ["Tmdb" "Local"];
              }
            ];
          };
        }
      ];
    }) {
      virtualFolders = [
        {
          name = "Movies";
          collectionType = "movies";
          libraryOptions = {
            pathInfos = [{path = "/data/movies";}];
            typeOptions = [
              {
                type = "Movie";
                metadataFetchers = [];
                metadataFetcherOrder = [];
                imageFetchers = [];
                imageFetcherOrder = [];
                similarItemProviders = ["Local" "Tmdb"];
                similarItemProviderOrder = ["Tmdb" "Local"];
              }
            ];
          };
        }
      ];
    })

  (assertEq "empty virtualFolders array" (mkLibraryConfig {virtualFolders = [];}) {virtualFolders = [];})

  (assertThrows "reject empty pathInfos" (mkLibraryConfig {
    virtualFolders = [
      {
        name = "Test";
        collectionType = "movies";
        libraryOptions = {pathInfos = [];};
      }
    ];
  }))
]
