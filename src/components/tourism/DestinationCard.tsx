import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, MapPin, Star } from 'lucide-react';
import { Destination } from '../../types/tourism.ts';
import { SafeImage } from '../ui/SafeImage.tsx';

interface DestinationCardProps {
  destination: Destination;
  onToggleFavorite?: (destinationId: number) => void;
}

export const DestinationCard: React.FC<DestinationCardProps> = ({
  destination,
  onToggleFavorite,
}) => {
  return (
    <article className="group bg-white border border-[#E3E9E4] rounded-xl overflow-hidden flex flex-col transition-colors duration-150 hover:border-[#16865B]/50">
      <div className="relative aspect-[4/3] overflow-hidden bg-[#E3E9E4]/30">
        <Link to={`/destinations/${destination.slug}`} className="block w-full h-full">
          <SafeImage
            src={destination.primaryImage}
            alt={destination.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        </Link>
        {onToggleFavorite && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onToggleFavorite(destination.id);
            }}
            aria-label={destination.isFavorited ? `Remove ${destination.name} from favorites` : `Save ${destination.name} to favorites`}
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/95 border border-[#E3E9E4] flex items-center justify-center text-[#123D2B] hover:border-[#16865B] transition-colors cursor-pointer"
          >
            <Heart
              className={`w-4 h-4 ${
                destination.isFavorited ? 'fill-[#D9A441] text-[#D9A441]' : 'text-[#202923]'
              }`}
            />
          </button>
        )}
      </div>

      <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
        <div className="space-y-2">
          {/* Unboxed typographic metadata line */}
          <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-xs text-[#69766E]">
            <span>{destination.category?.name || 'Destination'}</span>
            <span aria-hidden="true">·</span>
            <span>{destination.province}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 text-[#202923] font-medium tabular-nums">
              <Star className="w-3.5 h-3.5 fill-[#D9A441] text-[#D9A441]" />
              {destination.avgRating.toFixed(1)}
            </span>
          </div>

          <h3 className="font-serif text-lg font-semibold text-[#123D2B] leading-snug">
            <Link
              to={`/destinations/${destination.slug}`}
              className="hover:text-[#16865B] transition-colors"
            >
              {destination.name}
            </Link>
          </h3>

          <p className="text-sm text-[#69766E] line-clamp-2 leading-relaxed">
            {destination.shortSummary}
          </p>
        </div>

        <div className="pt-3 border-t border-[#E3E9E4] flex items-center justify-between text-xs">
          <span className="inline-flex items-center gap-1.5 text-[#69766E]">
            <MapPin className="w-3.5 h-3.5 text-[#16865B]" />
            <span>{destination.district} District</span>
          </span>
          <Link
            to={`/destinations/${destination.slug}`}
            className="font-semibold text-[#16865B] hover:text-[#123D2B] whitespace-nowrap"
          >
            View guide →
          </Link>
        </div>
      </div>
    </article>
  );
};
