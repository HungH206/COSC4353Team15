export default function NotificationPanel({ notifs, onClose, onRead }) {
  const displayTime = (item) => {
    if (item.time) return item.time;
    if (!item.createdAt) return '';
    return new Date(item.createdAt).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="notif-panel">
      <div className="notif-panel-header">
        <span>Notifications</span>
        <button type="button" onClick={onClose} className="icon-btn">×</button>
      </div>
      <div className="notif-list">
        {notifs.length === 0 ? (
          <div className="notif-empty">No notifications</div>
        ) : notifs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onRead(item.id)}
            className={`notif-item ${item.read ? '' : 'notif-item-unread'}`}
          >
            <div className="notif-item-message">{item.message}</div>
            <div className="notif-item-meta">{displayTime(item)}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
