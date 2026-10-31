import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NotificationStreams from './NotificationStreams';
import * as apiClientModule from '@lib/apiClient';

vi.mock('@lib/apiClient', async () => {
  const actual = await vi.importActual<typeof apiClientModule>('@lib/apiClient');
  return {
    ...actual,
    apiClient: vi.fn(),
  };
});

const mockedApiClient = vi.mocked(apiClientModule.apiClient);

describe('NotificationStreams Component (Approvals Tab Replacement)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('tlbm_access_token', 'test-token');
  });

  it('renders notification bell button', async () => {
    mockedApiClient.mockResolvedValue({});
    render(
      <MemoryRouter>
        <NotificationStreams />
      </MemoryRouter>
    );

    const bellBtn = screen.getByRole('button', { name: /thông báo/i });
    expect(bellBtn).toBeInTheDocument();
    await waitFor(() => expect(mockedApiClient).toHaveBeenCalled());
  });

  it('opens notification popover with "Chờ Duyệt" tab instead of "Lịch Họp"', async () => {
    mockedApiClient.mockResolvedValue({});
    render(
      <MemoryRouter>
        <NotificationStreams />
      </MemoryRouter>
    );

    await waitFor(() => expect(mockedApiClient).toHaveBeenCalled());

    // Click bell icon to open popover
    const bellBtn = screen.getByRole('button', { name: /thông báo/i });
    fireEvent.click(bellBtn);

    // Verify 4 stream tabs: Đến, Đi, Mật, Chờ Duyệt
    expect(screen.getByText('Đến')).toBeInTheDocument();
    expect(screen.getByText('Đi')).toBeInTheDocument();
    expect(screen.getByText('Mật')).toBeInTheDocument();
    expect(screen.getByText('Chờ Duyệt')).toBeInTheDocument();

    // Verify old "Lịch Họp" tab is NOT present in the notification tabs
    expect(screen.queryByRole('button', { name: /lịch họp/i })).not.toBeInTheDocument();
  });

  it('displays empty state and navigation footer when "Chờ Duyệt" tab is selected and no signing items', async () => {
    mockedApiClient.mockResolvedValue({
      kpis: { signingCount: 0 },
      recentSigning: [],
      tasks: [{ id: 1, title: 'Task cho duyet', status: 'pending' }],
    });

    render(
      <MemoryRouter>
        <NotificationStreams />
      </MemoryRouter>
    );

    const bellBtn = screen.getByRole('button', { name: /thông báo/i });
    fireEvent.click(bellBtn);

    const approvalsTab = screen.getByText('Chờ Duyệt');
    fireEvent.click(approvalsTab);

    // Empty state message for pending approvals must appear, not tasks
    await waitFor(() => {
      expect(screen.getByText('Không có hồ sơ trình ký chờ duyệt')).toBeInTheDocument();
    });
    expect(screen.queryByText('Task cho duyet')).not.toBeInTheDocument();
    expect(screen.getByText('Xem quy trình trình ký số điện tử »')).toBeInTheDocument();
  });

  it('only displays actionable signing documents (can_toi_ky: true) in "Chờ Duyệt" stream', async () => {
    mockedApiClient.mockResolvedValue({
      kpis: { signingCount: 1 },
      recentSigning: [
        { id: 101, ma_trinh_ky: 'TK-101', tieu_de: 'Ho so can toi ky', can_toi_ky: true },
        { id: 102, ma_trinh_ky: 'TK-102', tieu_de: 'Ho so nguoi khac ky', can_toi_ky: false },
      ],
    });

    render(
      <MemoryRouter>
        <NotificationStreams />
      </MemoryRouter>
    );

    const bellBtn = screen.getByRole('button', { name: /thông báo/i });
    fireEvent.click(bellBtn);

    const approvalsTab = screen.getByText('Chờ Duyệt');
    fireEvent.click(approvalsTab);

    await waitFor(() => {
      expect(screen.getByText('Ho so can toi ky')).toBeInTheDocument();
    });
    expect(screen.queryByText('Ho so nguoi khac ky')).not.toBeInTheDocument();
  });
});
