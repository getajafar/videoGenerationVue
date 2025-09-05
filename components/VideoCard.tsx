/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import {Video} from '../types';
import {PlayIcon, StarIconOutline, StarIconSolid} from './icons';

interface VideoCardProps {
  video: Video;
  onPlay: (video: Video) => void;
  isFavorite: boolean;
  onToggleFavorite: (videoId: string) => void;
}

/**
 * A component that renders a video card with a thumbnail, title, and play button.
 */
export const VideoCard: React.FC<VideoCardProps> = ({
  video,
  onPlay,
  isFavorite,
  onToggleFavorite,
}) => {
  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite(video.id);
  };

  return (
    <div className="relative">
      <button
        type="button"
        className="group w-full text-left bg-gray-800/50 rounded-lg overflow-hidden shadow-lg hover:shadow-gray-500/30 transform transition-all duration-300 hover:-translate-y-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
        onClick={() => onPlay(video)}
        aria-label={`Play video: ${video.title}`}>
        <div className="relative">
          <video
            className="w-full h-48 object-cover pointer-events-none"
            src={video.videoUrl}
            muted
            playsInline
            preload="metadata"
            aria-hidden="true"></video>
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <PlayIcon className="w-16 h-16 text-white opacity-80 drop-shadow-lg group-hover:opacity-100 transform group-hover:scale-110 transition-transform" />
          </div>
        </div>
        <div className="p-4">
          <h3
            className="text-base font-semibold text-gray-200 truncate"
            title={video.title}>
            {video.title}
          </h3>
        </div>
      </button>
      <button
        onClick={handleFavoriteClick}
        className="absolute top-2 right-2 p-2 rounded-full bg-black/30 hover:bg-black/50 transition-colors z-10"
        aria-label={isFavorite ? 'Unfavorite this video' : 'Favorite this video'}>
        {isFavorite ? (
          <StarIconSolid className="w-5 h-5 text-yellow-400" />
        ) : (
          <StarIconOutline className="w-5 h-5 text-white/80" />
        )}
      </button>
    </div>
  );
};
