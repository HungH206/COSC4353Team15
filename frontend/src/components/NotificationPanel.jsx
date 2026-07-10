export default function NotificationPanel({ notifs, onClose, onRead }) {
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
            <div className="notif-item-meta">{item.time}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
