import React, { useState } from 'react';

const TopBar = ({ userName = 'Patient', userAvatar, onMenuClick }) => {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <header className="bg-white/90 backdrop-blur-md border-b z-50 border-slate-100 shadow-sm flex justify-between items-center h-16 px-8 sticky top-0 w-full">
      {/* Left section */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="md:hidden text-slate-500 hover:text-[#003178] transition-colors duration-200"
          aria-label="Open menu"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
        <span className="md:hidden text-xl font-extrabold tracking-tight text-[#003178]">
          CEPSITCED
        </span>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2 ml-auto">
        {/* Search Bar */}
        <div className="relative w-64 mr-4 hidden md:block">
          <input
            className="w-full bg-slate-50 border border-slate-200 rounded-full pl-10 pr-4 py-1.5 text-sm text-slate-700 focus:border-[#003178] focus:ring-1 focus:ring-[#003178] transition-colors outline-none"
            placeholder="Search..."
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
            search
          </span>
        </div>

        {/* Notifications */}
        <button
          className="p-2 text-slate-500 hover:text-[#003178] transition-colors duration-200 rounded-full hover:bg-slate-100 relative"
          aria-label="Notifications"
        >
          <span className="material-symbols-outlined text-[20px]">notifications</span>
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>

        {/* Help */}
        <button
          className="p-2 text-slate-500 hover:text-[#003178] transition-colors duration-200 rounded-full hover:bg-slate-100 mr-2"
          aria-label="Help"
        >
          <span className="material-symbols-outlined text-[20px]">help</span>
        </button>

        {/* User Avatar */}
        <div className="flex items-center gap-2 ml-2 cursor-pointer">
          <div className="w-8 h-8 rounded-full bg-[#003178] text-white flex items-center justify-center text-sm font-bold">
            {userAvatar || userName.charAt(0).toUpperCase()}
          </div>
        </div>
      </div>
    </header>
  );
};

export default TopBar;