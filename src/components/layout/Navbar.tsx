import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ChevronDown, LogOut, Menu, Shield, User, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';

const NAV_LINKS = [
  { to: '/discover', label: 'Discover' },
  { to: '/map', label: 'Map' },
  { to: '/planner', label: 'Planner' },
  { to: '/stays', label: 'Stays' },
  { to: '/providers', label: 'Providers' },
];

export const Navbar: React.FC = () => {
  const { profile, isAdmin, signInWithGoogle, signOut, loading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  const handleSignIn = async () => {
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } catch {
      // Error surfaced cleanly via AuthContext
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-[#FAF9F5]/95 backdrop-blur-sm border-b border-[#E3E9E4]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single text element wordmark */}
        <Link
          to="/"
          className="font-serif text-lg sm:text-xl font-bold tracking-tight text-[#123D2B] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16865B] rounded"
        >
          Rwanda Tourism Explorer
        </Link>

        {/* Zone 2: Concise single-line navigation links */}
        <nav className="hidden md:flex items-center gap-7" aria-label="Primary Navigation">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `text-sm font-medium whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors duration-150 ${
                  isActive
                    ? 'text-[#123D2B] border-[#16865B]'
                    : 'text-[#69766E] border-transparent hover:text-[#123D2B] hover:border-[#E3E9E4]'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* Zone 3: Single primary action */}
        <div className="flex items-center gap-3 shrink-0">
          {!loading && !profile && (
            <button
              type="button"
              onClick={handleSignIn}
              disabled={signingIn}
              className="hidden md:inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-[#FAF9F5] bg-[#123D2B] hover:bg-[#16865B] rounded-lg transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
            >
              {signingIn ? 'Signing in...' : 'Sign In'}
            </button>
          )}

          {!loading && profile && (
            <div className="relative hidden md:block">
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-[#202923] bg-white border border-[#E3E9E4] hover:border-[#16865B] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                aria-expanded={menuOpen}
              >
                <User className="w-4 h-4 text-[#16865B]" />
                <span className="max-w-[140px] truncate">{profile.fullName}</span>
                <ChevronDown className="w-3.5 h-3.5 text-[#69766E]" />
              </button>

              {menuOpen && (
                <div
                  className="absolute right-0 mt-2 w-56 bg-white border border-[#E3E9E4] rounded-lg shadow-lg py-1.5 z-50"
                  onMouseLeave={() => setMenuOpen(false)}
                >
                  <div className="px-4 py-2 border-b border-[#E3E9E4]">
                    <p className="text-xs font-medium text-[#202923] truncate">{profile.fullName}</p>
                    <p className="text-xs text-[#69766E] truncate">{profile.email}</p>
                  </div>
                  <Link
                    to="/profile"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#202923] hover:bg-[#FAF9F5]"
                  >
                    <User className="w-4 h-4 text-[#69766E]" />
                    <span>Traveler Profile</span>
                  </Link>
                  {isAdmin && (
                    <Link
                      to="/admin"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#123D2B] font-medium hover:bg-[#FAF9F5]"
                    >
                      <Shield className="w-4 h-4 text-[#16865B]" />
                      <span>Admin Dashboard</span>
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={async () => {
                      setMenuOpen(false);
                      await signOut();
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#69766E] hover:text-[#202923] hover:bg-[#FAF9F5] border-t border-[#E3E9E4] cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-lg text-[#123D2B] hover:bg-[#E3E9E4]/50 cursor-pointer"
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-b border-[#E3E9E4] px-4 py-4 space-y-2">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `block px-3 py-3 rounded-lg text-sm font-medium ${
                  isActive ? 'bg-[#123D2B] text-white' : 'text-[#202923] hover:bg-[#FAF9F5]'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
          {profile ? (
            <>
              <Link
                to="/profile"
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-3 rounded-lg text-sm font-medium text-[#202923] hover:bg-[#FAF9F5]"
              >
                Traveler Profile
              </Link>
              {isAdmin && (
                <Link
                  to="/admin"
                  onClick={() => setMobileOpen(false)}
                  className="block px-3 py-3 rounded-lg text-sm font-medium text-[#123D2B] hover:bg-[#FAF9F5]"
                >
                  Admin Dashboard
                </Link>
              )}
              <button
                type="button"
                onClick={async () => {
                  setMobileOpen(false);
                  await signOut();
                }}
                className="w-full text-left px-3 py-3 rounded-lg text-sm font-medium text-[#69766E] hover:bg-[#FAF9F5] cursor-pointer"
              >
                Sign Out
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={async () => {
                setMobileOpen(false);
                await handleSignIn();
              }}
              className="w-full px-4 py-3 text-sm font-medium text-white bg-[#123D2B] rounded-lg cursor-pointer"
            >
              Sign In with Google
            </button>
          )}
        </div>
      )}
    </header>
  );
};
