import React from 'react';
import { useIsMobile } from '../hooks/useIsMobile';
import { Employee } from '../types/employee';
import { TaskDetail } from '../types/task';
import { daysUntil, isoToDisplay } from './DateInput';
import { employeeMeta } from './EmployeeSelect';
import TaskAttachmentList from './TaskAttachmentList';

/**
 * Khối "Nội dung công việc" theo ảnh mẫu, chia 2 cột nhỏ:
 * trái — nội dung, ngày tạo, người tạo và giao, tệp đính kèm;
 * phải — cán bộ chủ trì, thời hạn xử lý, yêu cầu xử lý.
 */

interface TaskInfoCardProps {
  task: TaskDetail;
  onError: (message: string) => void;
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
        {children}
      </div>
    </div>
  );
}

/** "(Chức vụ - Phòng ban)" sau tên; bỏ qua khi thiếu dữ liệu để không hiện ngoặc rỗng. */
function PersonMeta({ person }: { person: Employee }) {
  const meta = employeeMeta(person);
  if (!meta) return null;
  return <span style={{ color: 'var(--text-secondary)' }}> ({meta})</span>;
}

function DeadlineHint({ task }: { task: TaskDetail }) {
  // Công việc đã duyệt thì không cần nhắc hạn nữa.
  if (task.status === 'HOAN_THANH') return null;
  const days = daysUntil(task.dueDate);
  const text = days > 0 ? `còn ${days} ngày` : days === 0 ? 'hạn là hôm nay' : `quá hạn ${-days} ngày`;
  const color =
    days < 0 ? 'var(--color-danger)' : days <= 2 ? 'var(--color-warning-text)' : 'var(--text-secondary)';
  return <span style={{ marginLeft: '8px', fontSize: '0.8rem', fontWeight: 700, color }}>({text})</span>;
}

export default function TaskInfoCard({ task, onError }: TaskInfoCardProps) {
  const isMobile = useIsMobile();
  return (
    <section
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-xl)',
        padding: isMobile ? '14px 14px' : '18px 20px',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <h2 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '16px' }}>
        <i className="fa-solid fa-file-lines" style={{ color: 'var(--color-primary)', marginRight: '8px' }} />
        Nội dung công việc
      </h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))',
          gap: '16px 28px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Item label="Nội dung công việc">{task.title}</Item>
          <Item label="Ngày tạo công việc">{isoToDisplay(task.createdDate)}</Item>
          <Item label="Người tạo và giao công việc">
            {task.creator.fullName}
            <PersonMeta person={task.creator} />
          </Item>
          <Item label="Tệp tin đính kèm">
            <TaskAttachmentList files={task.attachments} onError={onError} compact />
          </Item>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Item label="Cán bộ chủ trì giải quyết">
            {task.host ? (
              <>
                {task.host.fullName}
                <PersonMeta person={task.host} />
              </>
            ) : (
              '—'
            )}
          </Item>
          <Item label="Thời hạn xử lý">
            {isoToDisplay(task.dueDate)}
            <DeadlineHint task={task} />
          </Item>
          <Item label="Yêu cầu xử lý">{task.requirement}</Item>
        </div>
      </div>
    </section>
  );
}
