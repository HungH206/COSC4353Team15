export const CREDENTIALS = [
  { email: 'user@demo.com', password: 'password123', name: 'Alex Chen', role: 'user', id: 'u1' },
  { email: 'admin@demo.com', password: 'password123', name: 'Sam Rivera', role: 'admin', id: 'a1' },
];

export const INIT_SERVICES = [
  { id: 's1', name: 'General Inquiry', description: 'Customer support and general questions.', expectedDuration: 10, priority: 'medium', isOpen: true },
  { id: 's2', name: 'Account Services', description: 'Account creation, profile updates, and credential help.', expectedDuration: 15, priority: 'high', isOpen: true },
  { id: 's3', name: 'Technical Support', description: 'Hardware and software troubleshooting.', expectedDuration: 25, priority: 'high', isOpen: true },
  { id: 's4', name: 'Document Processing', description: 'Review and process official documents.', expectedDuration: 8, priority: 'low', isOpen: false },
  { id: 's5', name: 'Billing & Payments', description: 'Payment support and billing questions.', expectedDuration: 12, priority: 'medium', isOpen: true },
];

export const INIT_QUEUES = {
  s1: [
    { id: 'q1', name: 'Rachel Kim', joinedAt: '9:15 AM', status: 'almost_ready' },
    { id: 'q2', name: 'Tom Wright', joinedAt: '9:22 AM', status: 'waiting' },
    { id: 'q3', name: 'Alex Chen', joinedAt: '9:30 AM', status: 'waiting' },
  ],
  s2: [
    { id: 'q4', name: 'Emma Wilson', joinedAt: '9:20 AM', status: 'almost_ready' },
    { id: 'q5', name: 'Carlos Reyes', joinedAt: '9:28 AM', status: 'waiting' },
  ],
  s3: [
    { id: 'q6', name: 'Mike Johnson', joinedAt: '9:00 AM', status: 'almost_ready' },
    { id: 'q7', name: 'Nina Patel', joinedAt: '9:15 AM', status: 'waiting' },
  ],
  s4: [],
  s5: [
    { id: 'q8', name: 'Isabella Cruz', joinedAt: '9:10 AM', status: 'almost_ready' },
    { id: 'q9', name: 'Noah Kim', joinedAt: '9:18 AM', status: 'waiting' },
  ],
};

export const HISTORY = [
  { id: 'h1', serviceName: 'Account Services', date: 'Jul 9, 2026', outcome: 'served', waitMinutes: 18 },
  { id: 'h2', serviceName: 'Technical Support', date: 'Jul 7, 2026', outcome: 'served', waitMinutes: 32 },
  { id: 'h3', serviceName: 'General Inquiry', date: 'Jul 5, 2026', outcome: 'left', waitMinutes: 12 },
  { id: 'h4', serviceName: 'Billing & Payments', date: 'Jun 30, 2026', outcome: 'served', waitMinutes: 9 },
  { id: 'h5', serviceName: 'General Inquiry', date: 'Jun 25, 2026', outcome: 'served', waitMinutes: 15 },
  { id: 'h6', serviceName: 'Document Processing', date: 'Jun 20, 2026', outcome: 'served', waitMinutes: 6 },
];

export const INIT_NOTIFS = [
  { id: 'n1', message: 'You are now 3rd in line for General Inquiry.', type: 'info', time: '9:30 AM', read: false },
  { id: 'n2', message: 'General Inquiry wait time updated to 20 min.', type: 'info', time: '9:25 AM', read: false },
  { id: 'n3', message: 'Account Services session completed successfully.', type: 'success', time: 'Jul 9', read: true },
  { id: 'n4', message: 'Technical Support queue is now open.', type: 'success', time: 'Jul 7', read: true },
];
