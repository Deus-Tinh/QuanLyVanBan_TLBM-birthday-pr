import React, { useCallback, useEffect, useState } from 'react';
import { toMessage } from '../api/client';
import { getMe } from '../api/employees';
import { approveTask, createComment, deleteEvidence, listComments, openTask, unapproveTask } from '../api/taskActions';
import { getTask } from '../api/tasks';
import ConfirmDialog from '../components/ConfirmDialog';
import TaskApprovalBar from '../components/TaskApprovalBar';
import TaskCommentPanel from '../components/TaskCommentPanel';
import TaskInfoCard from '../components/TaskInfoCard';
import TaskPeopleCard from '../components/TaskPeopleCard';
import TaskStatusBadge from '../components/TaskStatusBadge';
import WorkAlert, { WorkAlertVariant } from '../components/WorkAlert';
import { useIsMobile } from '../hooks/useIsMobile';
import { Attachment, TaskComment, TaskDetail } from '../types/task';

/**
 * Trang chi tiết xử lý công việc, bố cục theo ảnh mẫu của thầy:
 * cột trái "Luồng xử lý"; cột phải "Nội dung công việc" và khu vực ý kiến; nút Duyệt cuối trang.
 *
 * Vừa vào trang thì gọi openTask: chủ trì / chỉ đạo / tham gia mở lần đầu (khi chưa quá hạn)
 * được tính là "đã mở"; người tạo mở không tính.
 */

interface TaskDetailPageProps {
  taskId: number;
  onBack: () => void;
}

type PendingAction = { type: 'approve' } | { type: 'unapprove' } | { type: 'deleteFile'; file: Attachment } | null;

function statusNotice(task: TaskDetail): { variant: WorkAlertVariant; message: string } {
  switch (task.status) {
    case 'CHO_XU_LY':
      return { variant: 'info', message: 'Người thực hiện chưa mở công việc này.' };
    case 'DANG_XU_LY':
      return {
        variant: 'info',
        message: 'Đang xử lý. Khi làm xong, người chủ trì hoặc cán bộ tham gia gửi ý kiến kèm file kết quả để chuyển sang Chờ duyệt.',
      };
    case 'CHO_DUYET':
      return {
        variant: 'warning',
        message: 'Đã có file kết quả, đang chờ người tạo, người chủ trì hoặc người chỉ đạo duyệt.',
      };
    case 'HOAN_THANH':
      return { variant: 'success', message: 'Công việc đã được duyệt hoàn thành.' };
    default:
      return {
        variant: 'danger',
        message:
          'Công việc đã hết hạn khi chưa có file kết quả nên đã bị khóa: không ghi ý kiến, không nộp kết quả, không sửa được. Nếu vẫn cần thực hiện, hãy đề nghị người tạo giao công việc mới.',
      };
  }
}

export default function TaskDetailPage({ taskId, onBack }: TaskDetailPageProps) {
  const isMobile = useIsMobile();
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState<PendingAction>(null);
  const [pendingBusy, setPendingBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([openTask(taskId), listComments(taskId), getMe().catch(() => null)])
      .then(([detail, items, me]) => {
        if (cancelled) return;
        setTask(detail);
        setComments(items);
        setCurrentUserId(me ? me.id : null);
      })
      .catch((cause) => {
        if (!cancelled) setLoadError(toMessage(cause));
      })
      .finally(() => {
        if (cancelled) return;
        setLoaded(true);
        setCommentsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(''), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  /** Tải lại cả công việc lẫn ý kiến sau mỗi thao tác để trạng thái và nút luôn khớp máy chủ. */
  const refresh = useCallback(async () => {
    setCommentsLoading(true);
    try {
      const [detail, items] = await Promise.all([getTask(taskId), listComments(taskId)]);
      setTask(detail);
      setComments(items);
      return detail;
    } finally {
      setCommentsLoading(false);
    }
  }, [taskId]);

  const handleSubmitComment = async (content: string, files: File[]): Promise<string | null> => {
    try {
      await createComment(taskId, content, files);
      const before = task?.status;
      const detail = await refresh();
      setActionError('');
      if (files.length && before !== 'CHO_DUYET' && detail.status === 'CHO_DUYET') {
        setNotice(`Đã gửi ý kiến kèm ${files.length} file kết quả. Công việc chuyển sang Chờ duyệt.`);
      } else if (files.length) {
        setNotice(`Đã gửi ý kiến kèm ${files.length} file kết quả.`);
      } else {
        setNotice('Đã gửi ý kiến.');
      }
      return null;
    } catch (cause) {
      // Trạng thái có thể đã đổi (ví dụ vừa quá hạn): tải lại để khóa đúng ô nhập.
      refresh().catch(() => undefined);
      return toMessage(cause);
    }
  };

  const handleConfirm = async () => {
    if (!pending) return;
    setPendingBusy(true);
    try {
      if (pending.type === 'approve') {
        await approveTask(taskId);
        setNotice('Đã duyệt hoàn thành công việc.');
      } else if (pending.type === 'unapprove') {
        await unapproveTask(taskId);
        setNotice('Đã hủy duyệt. Công việc quay về trạng thái Chờ duyệt.');
      } else {
        await deleteEvidence(taskId, pending.file.id);
        setNotice(`Đã xóa file "${pending.file.fileName}". Ý kiến chứa file vẫn được giữ lại.`);
      }
      setActionError('');
    } catch (cause) {
      setActionError(toMessage(cause));
    } finally {
      await refresh().catch(() => undefined);
      setPendingBusy(false);
      setPending(null);
    }
  };

  if (!loaded) {
    return (
      <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <i className="fa-solid fa-circle-notch fa-spin" /> Đang tải chi tiết công việc...
      </div>
    );
  }

  if (!task) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <WorkAlert variant="danger" title="Không mở được công việc" message={loadError} />
        <div>
          <button
            type="button"
            onClick={onBack}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-surface)',
              color: 'var(--text-main)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <i className="fa-solid fa-arrow-left" />
            Quay lại danh sách
          </button>
        </div>
      </div>
    );
  }

  const statusInfo = statusNotice(task);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={onBack}
          aria-label="Quay lại danh sách"
          title="Quay lại danh sách"
          style={{
            width: '36px',
            height: '36px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface)',
            color: 'var(--text-main)',
            cursor: 'pointer',
          }}
        >
          <i className="fa-solid fa-arrow-left" />
        </button>
        <h1 style={{ fontSize: isMobile ? '1.05rem' : '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>Chi tiết xử lý công việc</h1>
        <TaskStatusBadge status={task.status} label={task.statusLabel} />
        {!task.isPublic && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 10px',
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--color-purple-border)',
              color: 'var(--color-purple)',
              fontSize: '0.75rem',
              fontWeight: 700,
            }}
          >
            <i className="fa-solid fa-eye-slash" />
            Đang ẩn
          </span>
        )}
      </div>

      <WorkAlert variant={statusInfo.variant} message={statusInfo.message} />
      {notice && <WorkAlert variant="success" message={notice} onClose={() => setNotice('')} />}
      {actionError && <WorkAlert variant="danger" message={actionError} onClose={() => setActionError('')} />}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 260px', minWidth: 0 }}>
          <TaskPeopleCard task={task} currentUserId={currentUserId} />
        </div>

        <div style={{ flex: '1000 1 560px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <TaskInfoCard task={task} onError={setActionError} />
          <TaskCommentPanel
            task={task}
            comments={comments}
            loading={commentsLoading}
            onBack={onBack}
            onSubmit={handleSubmitComment}
            onDeleteFile={(file) => setPending({ type: 'deleteFile', file })}
            onError={setActionError}
          />
        </div>
      </div>

      <TaskApprovalBar
        task={task}
        busy={pendingBusy}
        onApprove={() => setPending({ type: 'approve' })}
        onUnapprove={() => setPending({ type: 'unapprove' })}
      />

      <ConfirmDialog
        open={pending !== null}
        loading={pendingBusy}
        danger={pending?.type === 'deleteFile'}
        title={
          pending?.type === 'approve'
            ? 'Duyệt hoàn thành công việc'
            : pending?.type === 'unapprove'
              ? 'Hủy duyệt công việc'
              : 'Xóa file kết quả'
        }
        confirmLabel={
          pending?.type === 'approve' ? 'Duyệt hoàn thành' : pending?.type === 'unapprove' ? 'Hủy duyệt' : 'Xóa file'
        }
        message={
          pending?.type === 'approve'
            ? 'Xác nhận công việc đã hoàn thành? Sau khi duyệt, người thực hiện không nộp thêm hay xóa file kết quả được, trừ khi hủy duyệt.'
            : pending?.type === 'unapprove'
              ? 'Hủy duyệt sẽ đưa công việc về trạng thái Chờ duyệt để người thực hiện bổ sung kết quả. Có thể duyệt lại sau.'
              : pending?.type === 'deleteFile'
                ? `Xóa file "${pending.file.fileName}"? Ý kiến chứa file vẫn được giữ lại. Thao tác này không hoàn tác được.`
                : ''
        }
        onCancel={() => setPending(null)}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
