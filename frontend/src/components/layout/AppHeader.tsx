import React from 'react';
import NotificationStreams from './NotificationStreams';
import ThemeSelector from './ThemeSelector';
import LanguageSwitcher from './LanguageSwitcher';
import UserDropdown from './UserDropdown';
import { ThemeMode } from '@app-types/theme';
import { ActivePageId } from '@app-types/navigation';

interface AppHeaderProps {
  currentTheme: ThemeMode;
  onSelectTheme: (theme: ThemeMode) => void;
  onToggleTheme?: () => void;
  onToggleSidebar: () => void;
  isSidebarOpen?: boolean;
  onNavigate?: (pageId: ActivePageId) => void;
  preferredLightTheme?: ThemeMode;
  preferredDarkTheme?: ThemeMode;
  activePage?: ActivePageId;
  isScrolled?: boolean;
  onScrollToTop?: () => void;
}

import { Logo } from '@components/common/Logo';
import { useTranslation } from '@i18n/translate';
import { SubNavContent } from './TopSubNav';

export default function AppHeader({
  currentTheme,
  onSelectTheme,
  onToggleTheme,
  onToggleSidebar,
  isSidebarOpen,
  onNavigate,
  preferredLightTheme,
  preferredDarkTheme,
  activePage,
  isScrolled = false,
  onScrollToTop,
}: AppHeaderProps) {
  const { t } = useTranslation();

  return (
    <header className="h-16 px-4 bg-header border-b border-subtle flex items-center justify-between shrink-0 z-30 backdrop-blur-md transition-colors duration-normal">
      {/* 1. Left Section: 3-bar Menu Trigger & Bao Long Logo (Ẩn khi Sidebar mở rộng để chống trùng lặp trên cùng khung hình) */}
      <div className="flex items-center gap-3.5 shrink-0">
        {!isSidebarOpen && (
          <>
            <button
              type="button"
              className="header-menu-btn lg:hidden w-10 h-10 rounded-xl flex items-center justify-center text-text-secondary hover:text-text-main hover:bg-surface-hover transition-colors duration-fast cursor-pointer shrink-0"
              onClick={onToggleSidebar}
              title={t('header.menuTooltip')}
              aria-label={t('header.menuAria')}
            >
              <i className="fa-solid fa-bars text-lg" />
            </button>
            <div
              className="flex items-center cursor-pointer transition-transform hover:scale-[1.03]"
              onClick={() => onNavigate?.('dashboard')}
              title="Bảo Long Insurance - Về Trang Chủ"
            >
              <Logo size="xl" className="h-11 sm:h-12" />
            </div>
          </>
        )}
      </div>

      {/* 2. Middle Section: Dynamic Header Bar khi lăn chuột (Chỉ hiển thị trên Desktop >= 1024px khi có đủ khoảng trống) */}
      <div className="hidden lg:flex flex-1 items-center justify-start min-w-0 px-4 overflow-hidden">
        {isScrolled && activePage && (
          <div className="w-full max-w-3xl transition-all duration-300 ease-out animate-in fade-in slide-in-from-top-1">
            <SubNavContent
              activePage={activePage}
              onNavigate={onNavigate}
              onScrollToTop={onScrollToTop}
              isCompact={true}
            />
          </div>
        )}
      </div>

      {/* 3. Right Section: Notifications, Theme, Language, User */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Thông báo 3 luồng: Đến, Đi, Mật */}
        <NotificationStreams />

        {/* Đổi nhanh Theme Sáng / Tối trực tiếp 1-chạm */}
        <ThemeSelector
          currentTheme={currentTheme}
          onSelectTheme={onSelectTheme}
          onToggleTheme={onToggleTheme}
          preferredLightTheme={preferredLightTheme}
          preferredDarkTheme={preferredDarkTheme}
        />

        {/* Chuyển đổi ngôn ngữ Tiếng Việt / Tiếng Anh */}
        <LanguageSwitcher />

        {/* Hồ sơ cá nhân người dùng */}
        <UserDropdown onNavigate={onNavigate} />
      </div>
    </header>
  );
}



