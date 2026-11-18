import React from 'react';
import { Link } from 'react-router-dom';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-[#123D2B] text-[#FAF9F5] border-t border-[#16865B]/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="md:col-span-2 space-y-3">
            <h2 className="font-serif text-2xl font-semibold text-white">
              Rwanda Tourism Explorer
            </h2>
            <p className="text-sm text-[#FAF9F5]/80 max-w-md leading-relaxed">
              Discover Rwanda. Experience the Extraordinary. An integrated digital discovery,
              GIS mapping, weather intelligence, and multi-day itinerary planning platform for
              the Land of a Thousand Hills.
            </p>
            <p className="text-xs text-[#D9A441] pt-1">
              Visitor Assistance Helpline · +250 788 311 000 · Kigali, Rwanda (EAT / UTC+02:00)
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white">Explore</h3>
            <ul className="space-y-2 text-sm text-[#FAF9F5]/75">
              <li>
                <Link to="/discover" className="hover:text-white transition-colors">
                  Destinations Directory
                </Link>
              </li>
              <li>
                <Link to="/map" className="hover:text-white transition-colors">
                  Interactive GIS Map
                </Link>
              </li>
              <li>
                <Link to="/planner" className="hover:text-white transition-colors">
                  Travel Itinerary Planner
                </Link>
              </li>
              <li>
                <Link to="/stays" className="hover:text-white transition-colors">
                  Verified Accommodations
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white">Partners & Governance</h3>
            <ul className="space-y-2 text-sm text-[#FAF9F5]/75">
              <li>
                <Link to="/providers" className="hover:text-white transition-colors">
                  Tour Operators & Guides
                </Link>
              </li>
              <li>
                <Link to="/profile" className="hover:text-white transition-colors">
                  Traveler Account
                </Link>
              </li>
              <li>
                <Link to="/admin" className="hover:text-white transition-colors">
                  Administration Console
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-white/15 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-[#FAF9F5]/70">
          <p>© {new Date().getFullYear()} Rwanda Tourism Explorer. Map data © OpenStreetMap contributors.</p>
          <p>Routing via OSRM · Weather via Open-Meteo · Media via Wikimedia Commons</p>
        </div>
      </div>
    </footer>
  );
};
