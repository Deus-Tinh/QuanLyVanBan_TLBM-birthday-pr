import { useEffect, useState } from 'react';
import { ApiError, apiClient } from '@lib/apiClient';
import { useTranslation } from '@i18n/translate';

type EmailStatus = 'PENDING' | 'SENDING' | 'SUCCESS' | 'FAILED' | 'RETRY';
type StatusFilter = EmailStatus | 'ALL';

interface BirthdayEmailLog {
  id: number;
  employee_name: string;
  recipient_email: string;
  position: string;
  department: string;
  sent_date: string;
  sent_at: string | null;
  trang_thai: EmailStatus;
  retry_count: number;
  error_message: string;
  smtp_response_code: string;
}

interface BirthdayEmailLogsResponse {
  success: boolean;
  total: number;
  page: number;
  total_pages: number;
  logs: BirthdayEmailLog[];
}

interface LoadState {
  key: string;
  data: BirthdayEmailLogsResponse | null;
  error: string | null;
}

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'ALL', label: 'allStatuses' },
  { value: 'PENDING', label: 'statusPending' },
  { value: 'SENDING', label: 'statusSending' },
  { value: 'SUCCESS', label: 'statusSuccess' },
  { value: 'FAILED', label: 'statusFailed' },
  { value: 'RETRY', label: 'statusRetry' },
];

const STATUS_STYLES: Record<EmailStatus, string> = {
  PENDING: 'bg-surface-hover text-secondary',
  SENDING: 'bg-info-subtle text-info',
  SUCCESS: 'bg-success-subtle text-success',
  FAILED: 'bg-danger-subtle text-danger',
  RETRY: 'bg-warning-subtle text-warning-text',
};

function statusLabelKey(status: EmailStatus): string {
  return `birthdayPage.emailLogs.status${status.charAt(0)}${status.slice(1).toLowerCase()}`;
}

export default function BirthdayEmailLogs({ month, year }: { month: number; year: number }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [loadState, setLoadState] = useState<LoadState>({ key: '', data: null, error: null });

  const requestKey = `${year}-${month}-${status}-${page}-${retry}`;
  const loading = loadState.key !== requestKey;
  const data = loading ? null : loadState.data;
  const error = loading ? null : loadState.error;
  const logs = Array.isArray(data?.logs) ? data.logs : [];

  useEffect(() => {
    let active = true;
    const query = new URLSearchParams({ month: String(month), year: String(year), page: String(page) });
    if (status !== 'ALL') query.set('trang_thai', status);

    apiClient.get<BirthdayEmailLogsResponse>(`/api/birthdays/logs/?${query.toString()}`)
      .then((response) => {
        if (active) setLoadState({ key: requestKey, data: response, error: null });
      })
      .catch((reason: unknown) => {
        const message = reason instanceof ApiError && reason.status === 403
          ? t('birthdays.messages.permissionDenied')
          : t('birthdayPage.emailLogs.loadError');
        if (active) setLoadState({ key: requestKey, data: null, error: message });
      });

    return () => { active = false; };
  }, [month, page, requestKey, status, t, year]);

  return (
    <section
      aria-labelledby="birthday-email-logs-title"
      className="mt-6 rounded-xl border border-border bg-surface p-4 shadow-xs sm:p-5"
    >
      <header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="birthday-email-logs-title" className="text-base font-bold text-main">
            {t('birthdayPage.emailLogs.title')}
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-secondary">
            {t('birthdayPage.emailLogs.description')}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs font-semibold text-secondary">
            <span>{t('birthdayPage.emailLogs.filterByStatus')}</span>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as StatusFilter);
                setPage(1);
              }}
              className="min-h-9 rounded-xs border border-border bg-surface px-2.5 text-sm text-main focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(`birthdayPage.emailLogs.${option.label}`)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setRetry((value) => value + 1)}
            disabled={loading}
            className="min-h-9 rounded-xs border border-border bg-surface px-3 text-sm font-semibold text-primary transition-colors hover:bg-primary-subtle disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {t('birthdayPage.emailLogs.refresh')}
          </button>
        </div>
      </header>

      <div className="mt-4">
        {loading ? (
          <div className="py-10 text-center text-sm text-muted" role="status">
            {t('birthdayPage.emailLogs.loading')}
          </div>
        ) : error ? (
          <div className="py-8 text-center text-sm text-danger" role="alert">
            {error}
          </div>
        ) : logs.length === 0 ? (
          <div className="py-10 text-center text-sm text-secondary">
            {t('birthdayPage.emailLogs.empty')}
          </div>
        ) : (
          <>
            <p className="mb-3 text-xs text-secondary">
              {t('birthdayPage.emailLogs.total', { count: String(data?.total ?? 0) })}
            </p>
            <div className="overflow-x-auto rounded-xs border border-border">
              <table className="w-full min-w-[920px] border-collapse text-left text-sm">
                <thead className="bg-surface-hover text-xs uppercase text-secondary">
                  <tr>
                    <th scope="col" className="px-3 py-2.5 font-semibold">{t('birthdayPage.emailLogs.employee')}</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">{t('birthdayPage.emailLogs.email')}</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">{t('birthdayPage.emailLogs.position')}</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">{t('birthdayPage.emailLogs.department')}</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">{t('birthdayPage.emailLogs.birthdayDate')}</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">{t('birthdayPage.emailLogs.sentAt')}</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">{t('birthdayPage.emailLogs.status')}</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">{t('birthdayPage.emailLogs.retries')}</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">{t('birthdayPage.emailLogs.details')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {logs.map((log) => (
                    <tr key={log.id} className="align-top text-main hover:bg-surface-hover/60">
                      <td className="px-3 py-3 font-semibold">{log.employee_name}</td>
                      <td className="px-3 py-3 text-secondary">{log.recipient_email || '—'}</td>
                      <td className="px-3 py-3 text-secondary">{log.position || '—'}</td>
                      <td className="px-3 py-3 text-secondary">{log.department || '—'}</td>
                      <td className="whitespace-nowrap px-3 py-3">{log.sent_date}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-secondary">{log.sent_at || '—'}</td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex whitespace-nowrap rounded-xs px-2 py-1 text-xs font-semibold ${STATUS_STYLES[log.trang_thai]}`}>
                          {t(statusLabelKey(log.trang_thai))}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center tabular-nums">{log.retry_count}</td>
                      <td className="max-w-sm px-3 py-3 text-secondary">
                        {log.error_message || log.smtp_response_code || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(data?.total_pages ?? 0) > 1 && (
              <nav
                aria-label={t('birthdayPage.emailLogs.paginationLabel')}
                className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3 text-xs text-secondary"
              >
                <button
                  type="button"
                  disabled={(data?.page ?? 1) <= 1}
                  onClick={() => setPage((data?.page ?? 1) - 1)}
                  className="rounded-xs bg-surface-hover px-2.5 py-1 text-main disabled:opacity-40 hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {t('birthdayPage.emailLogs.previousPage')}
                </button>
                <span>
                  {t('birthdayPage.emailLogs.pageCount', {
                    page: String(data?.page ?? 1),
                    total: String(data?.total_pages ?? 1),
                  })}
                </span>
                <button
                  type="button"
                  disabled={(data?.page ?? 1) >= (data?.total_pages ?? 1)}
                  onClick={() => setPage((data?.page ?? 1) + 1)}
                  className="rounded-xs bg-surface-hover px-2.5 py-1 text-main disabled:opacity-40 hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {t('birthdayPage.emailLogs.nextPage')}
                </button>
              </nav>
            )}
          </>
        )}
      </div>
    </section>
  );
}
