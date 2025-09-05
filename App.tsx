/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, {useMemo, useState} from 'react';
import {EditVideoPage} from './components/EditVideoPage';
import {ErrorModal} from './components/ErrorModal';
import {SearchIcon, VideoCameraIcon} from './components/icons';
import {SavingProgressPage} from './components/SavingProgressPage';
import {VideoGrid} from './components/VideoGrid';
import {VideoPlayer} from './components/VideoPlayer';
import {MOCK_VIDEOS} from './constants';
import {Video} from './types';

import {GeneratedVideo, GoogleGenAI} from '@google/genai';

const VEO_MODEL_NAME = 'veo-2.0-generate-001';
const FAVORITES_STORAGE_KEY = 'veo-gallery-favorites';

const ai = new GoogleGenAI({apiKey: process.env.API_KEY});

// ---

function bloblToBase64(blob: Blob) {
  return new Promise<string>(async (resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      resolve(url.split(',')[1]);
    };
    reader.readAsDataURL(blob);
  });
}

// ---

async function generateVideoFromText(
  prompt: string,
  numberOfVideos = 1,
  aspectRatio = '16:9',
): Promise<string[]> {
  let operation = await ai.models.generateVideos({
    model: VEO_MODEL_NAME,
    prompt,
    config: {
      numberOfVideos,
      aspectRatio,
    },
  });

  while (!operation.done) {
    await new Promise((resolve) => setTimeout(resolve, 10000));
    console.log('...Generating...');
    operation = await ai.operations.getVideosOperation({operation});
  }

  if (operation?.response) {
    const videos = operation.response?.generatedVideos;
    if (videos === undefined || videos.length === 0) {
      throw new Error('No videos generated');
    }

    return await Promise.all(
      videos.map(async (generatedVideo: GeneratedVideo) => {
        const url = decodeURIComponent(generatedVideo.video.uri);
        const res = await fetch(`${url}&key=${process.env.API_KEY}`);
        if (!res.ok) {
          throw new Error(
            `Failed to fetch video: ${res.status} ${res.statusText}`,
          );
        }
        const blob = await res.blob();
        return bloblToBase64(blob);
      }),
    );
  } else {
    throw new Error('No videos generated');
  }
}

/**
 * Main component for the Veo3 Gallery app.
 * It manages the state of videos, playing videos, editing videos and error handling.
 */
export const App: React.FC = () => {
  const [generatedVideos, setGeneratedVideos] = useState<Video[]>([]);
  const [activeTab, setActiveTab] = useState<
    'gallery' | 'creations' | 'favorites'
  >('gallery');
  const [playingVideo, setPlayingVideo] = useState<Video | null>(null);
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [generationError, setGenerationError] = useState<string[] | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [favoriteVideoIds, setFavoriteVideoIds] = useState<Set<string>>(() => {
    try {
      const storedFavorites = localStorage.getItem(FAVORITES_STORAGE_KEY);
      return storedFavorites ? new Set(JSON.parse(storedFavorites)) : new Set();
    } catch (error) {
      console.error('Failed to parse favorites from localStorage', error);
      return new Set();
    }
  });

  React.useEffect(() => {
    localStorage.setItem(
      FAVORITES_STORAGE_KEY,
      JSON.stringify(Array.from(favoriteVideoIds)),
    );
  }, [favoriteVideoIds]);

  const handleToggleFavorite = (videoId: string) => {
    setFavoriteVideoIds((prev) => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(videoId)) {
        newFavorites.delete(videoId);
      } else {
        newFavorites.add(videoId);
      }
      return newFavorites;
    });
  };

  const handlePlayVideo = (video: Video) => {
    setPlayingVideo(video);
  };

  const handleClosePlayer = () => {
    setPlayingVideo(null);
  };

  const handleStartEdit = (video: Video) => {
    setPlayingVideo(null); // Close player
    setEditingVideo(video); // Open edit page
  };

  const handleCancelEdit = () => {
    setEditingVideo(null); // Close edit page, return to grid
  };

  const handleSaveEdit = async (
    videoWithUpdatedDesc: Video,
    config: {numberOfVideos: number; aspectRatio: string},
  ) => {
    setEditingVideo(null);
    setIsSaving(true);
    setGenerationError(null);

    try {
      const promptText = videoWithUpdatedDesc.description;
      console.log('Generating video...', promptText);
      const videoObjects = await generateVideoFromText(
        promptText,
        config.numberOfVideos,
        config.aspectRatio,
      );

      if (!videoObjects || videoObjects.length === 0) {
        throw new Error('Video generation returned no data.');
      }

      console.log('Generated video data received.');

      const mimeType = 'video/mp4';

      const newVideos: Video[] = videoObjects.map((videoSrc, index) => {
        const src = `data:${mimeType};base64,${videoSrc}`;
        return {
          id: self.crypto.randomUUID(),
          title:
            config.numberOfVideos > 1
              ? `Remix of "${videoWithUpdatedDesc.title}" (${index + 1}/${
                  config.numberOfVideos
                })`
              : `Remix of "${videoWithUpdatedDesc.title}"`,
          description: videoWithUpdatedDesc.description,
          videoUrl: src,
        };
      });

      setGeneratedVideos((currentVideos) => [...newVideos, ...currentVideos]);
      setActiveTab('creations');
      setPlayingVideo(newVideos[0]); // Go to the first new video
    } catch (error) {
      console.error('Video generation failed:', error);
      setGenerationError([
        'Veo is only available on the Paid Tier.',
        'Please select your Cloud Project to get started',
      ]);
    } finally {
      setIsSaving(false);
    }
  };

  const allVideos = useMemo(
    () => [...MOCK_VIDEOS, ...generatedVideos],
    [generatedVideos],
  );

  const favoriteVideos = useMemo(
    () => allVideos.filter((video) => favoriteVideoIds.has(video.id)),
    [allVideos, favoriteVideoIds],
  );

  const videosToDisplay =
    activeTab === 'gallery'
      ? MOCK_VIDEOS
      : activeTab === 'creations'
      ? generatedVideos
      : favoriteVideos;

  const filteredVideos = videosToDisplay.filter(
    (video) =>
      video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      video.description.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  if (isSaving) {
    return <SavingProgressPage />;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans">
      {editingVideo ? (
        <EditVideoPage
          video={editingVideo}
          onSave={handleSaveEdit}
          onCancel={handleCancelEdit}
        />
      ) : (
        <div className="mx-auto max-w-[1080px]">
          <header className="p-6 md:p-8 text-center">
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 text-transparent bg-clip-text inline-flex items-center gap-4">
              <VideoCameraIcon className="w-10 h-10 md:w-12 md:h-12" />
              <span>Veo Gallery</span>
            </h1>
            <p className="text-gray-400 mt-2 text-lg">
              Select a video to generate your own variations
            </p>
            <div className="mt-6 max-w-lg mx-auto">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <SearchIcon className="w-5 h-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search videos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-full py-3 pl-11 pr-4 text-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-shadow duration-200"
                  aria-label="Search videos by title or description"
                />
              </div>
            </div>
          </header>

          <div className="px-4 md:px-8">
            <div className="border-b border-gray-700">
              <nav
                className="-mb-px flex justify-center space-x-8"
                aria-label="Tabs">
                <button
                  onClick={() => setActiveTab('gallery')}
                  className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 rounded-t-md ${
                    activeTab === 'gallery'
                      ? 'border-purple-500 text-purple-400'
                      : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'
                  }`}
                  aria-current={activeTab === 'gallery' ? 'page' : undefined}>
                  Gallery
                </button>
                <button
                  onClick={() => setActiveTab('creations')}
                  className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 rounded-t-md ${
                    activeTab === 'creations'
                      ? 'border-purple-500 text-purple-400'
                      : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'
                  }`}
                  aria-current={
                    activeTab === 'creations' ? 'page' : undefined
                  }>
                  My Creations
                </button>
                <button
                  onClick={() => setActiveTab('favorites')}
                  className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 rounded-t-md ${
                    activeTab === 'favorites'
                      ? 'border-purple-500 text-purple-400'
                      : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'
                  }`}
                  aria-current={
                    activeTab === 'favorites' ? 'page' : undefined
                  }>
                  Favorites
                </button>
              </nav>
            </div>
          </div>

          <main className="px-4 md:px-8 pb-8 pt-6">
            {filteredVideos.length > 0 ? (
              <VideoGrid
                videos={filteredVideos}
                onPlayVideo={handlePlayVideo}
                favoriteVideoIds={favoriteVideoIds}
                onToggleFavorite={handleToggleFavorite}
              />
            ) : (
              <div className="text-center py-16 text-gray-500">
                {activeTab === 'creations' && generatedVideos.length === 0 ? (
                  <>
                    <h2 className="text-xl font-semibold text-gray-300">
                      Your creations will appear here.
                    </h2>
                    <p className="mt-2">
                      Select a video from the Gallery to generate your first
                      variation!
                    </p>
                  </>
                ) : activeTab === 'favorites' && favoriteVideos.length === 0 ? (
                  <>
                    <h2 className="text-xl font-semibold text-gray-300">
                      No favorites yet.
                    </h2>
                    <p className="mt-2">
                      Click the star icon on any video to add it to your
                      favorites.
                    </p>
                  </>
                ) : (
                  <p>
                    No videos found matching your search for "{searchQuery}".
                  </p>
                )}
              </div>
            )}
          </main>
        </div>
      )}

      {playingVideo && (
        <VideoPlayer
          video={playingVideo}
          onClose={handleClosePlayer}
          onEdit={handleStartEdit}
          isFavorite={favoriteVideoIds.has(playingVideo.id)}
          onToggleFavorite={handleToggleFavorite}
        />
      )}

      {generationError && (
        <ErrorModal
          message={generationError}
          onClose={() => setGenerationError(null)}
          onSelectKey={async () => await window.aistudio?.openSelectKey()}
        />
      )}
    </div>
  );
};