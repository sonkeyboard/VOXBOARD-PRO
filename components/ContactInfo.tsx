
import React from 'react';

export const ContactInfo: React.FC = () => {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-md shadow-xl mt-auto">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-lg bg-[#e1322b] flex items-center justify-center text-white shadow-lg shadow-red-500/20">
          <i className="fa-solid fa-address-card text-xs"></i>
        </div>
        <div>
          <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Liên hệ & Hỗ trợ</h3>
          <p className="text-[8px] text-slate-500 font-bold uppercase">Đại diện: Phạm Thanh Sơn</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-col">
          <span className="text-[11px] font-black text-white uppercase tracking-wider">Phạm Thanh Sơn</span>
          <a 
            href="mailto:Sonpham@newsound.vn" 
            className="text-[10px] text-slate-400 hover:text-[#e1322b] transition-colors flex items-center gap-2 mt-1"
          >
            <i className="fa-solid fa-envelope text-[9px]"></i>
            Sonpham@newsound.vn
          </a>
        </div>

        <div className="flex gap-2 pt-2 border-t border-slate-800">
          <a 
            href="https://newsound.vn/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-blue-600 hover:text-white transition-all shadow-md"
            title="Website"
          >
            <i className="fa-solid fa-globe text-xs"></i>
          </a>
          <a 
            href="https://www.youtube.com/@PhamThanhSon" 
            target="_blank" 
            rel="noopener noreferrer"
            className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-red-600 hover:text-white transition-all shadow-md"
            title="YouTube Channel"
          >
            <i className="fa-brands fa-youtube text-xs"></i>
          </a>
          <a 
            href="https://www.facebook.com/newsound.vn/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-blue-800 hover:text-white transition-all shadow-md"
            title="Facebook Page"
          >
            <i className="fa-brands fa-facebook-f text-xs"></i>
          </a>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-800/50">
        <p className="text-[7px] text-slate-600 font-black uppercase tracking-widest text-center">
          © 2024 New Sound • Professional Audio Solutions
        </p>
      </div>
    </div>
  );
};
