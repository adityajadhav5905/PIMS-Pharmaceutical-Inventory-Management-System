import { useState, useEffect, useMemo } from 'react';
import {
  LifeBuoy,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  Eye,
  Check,
  RotateCcw,
  Mail,
  User,
  Calendar,
  MessageSquare,
} from 'lucide-react';
import { api } from '../lib/api';
import Modal from '../components/Modal';

export default function SupportTickets() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [statusFilter, setStatusFilter] = useState(''); // '' | 'open' | 'closed'
  const [search, setSearch] = useState('');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  const loadTickets = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.getSupportTickets(statusFilter, search);
      setTickets(response.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load support tickets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, [statusFilter]);

  // Client-side debounce on search
  useEffect(() => {
    const timer = setTimeout(() => {
      loadTickets();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Calculate statistics from all tickets
  const stats = useMemo(() => {
    const total = tickets.length;
    const open = tickets.filter((t) => t.status === 'open').length;
    const closed = tickets.filter((t) => t.status === 'closed').length;
    return { total, open, closed };
  }, [tickets]);

  const handleStatusToggle = async (ticket) => {
    const nextStatus = ticket.status === 'open' ? 'closed' : 'open';
    setUpdatingId(ticket.id);
    setActionSuccess('');
    setError('');

    try {
      const res = await api.updateTicketStatus(ticket.id, nextStatus);
      const updatedTicket = res.data || { ...ticket, status: nextStatus };

      setTickets((prev) =>
        prev.map((t) => (t.id === ticket.id ? { ...t, status: nextStatus } : t))
      );

      if (selectedTicket && selectedTicket.id === ticket.id) {
        setSelectedTicket((prev) => ({ ...prev, status: nextStatus }));
      }

      setActionSuccess(`Ticket #${ticket.id} marked as ${nextStatus}.`);
      setTimeout(() => setActionSuccess(''), 4000);
    } catch (err) {
      setError(err.message || `Failed to update status for ticket #${ticket.id}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400">
              <LifeBuoy className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 sm:text-3xl">
                Support Tickets
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Review and resolve user help requests, feedback, and technical inquiries
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={loadTickets}
          disabled={loading}
          className="inline-flex items-center gap-2 self-start rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 sm:self-auto"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Notifications */}
      {actionSuccess && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700 dark:border-green-900/50 dark:bg-green-950/20 dark:text-green-400">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => setStatusFilter('')}
          className={`flex items-center justify-between rounded-xl border p-5 text-left transition-all ${
            statusFilter === ''
              ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-500/20 dark:border-blue-500 dark:bg-blue-950/20'
              : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600'
          }`}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Total Tickets
            </p>
            <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
              {stats.total}
            </p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
            <MessageSquare className="h-6 w-6" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('open')}
          className={`flex items-center justify-between rounded-xl border p-5 text-left transition-all ${
            statusFilter === 'open'
              ? 'border-amber-500 bg-amber-50/50 ring-2 ring-amber-500/20 dark:border-amber-500 dark:bg-amber-950/20'
              : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600'
          }`}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Open Tickets
            </p>
            <p className="mt-1 text-2xl font-bold text-amber-700 dark:text-amber-300">
              {stats.open}
            </p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400">
            <Clock className="h-6 w-6" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('closed')}
          className={`flex items-center justify-between rounded-xl border p-5 text-left transition-all ${
            statusFilter === 'closed'
              ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20 dark:border-emerald-500 dark:bg-emerald-950/20'
              : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600'
          }`}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Resolved Tickets
            </p>
            <p className="mt-1 text-2xl font-bold text-emerald-700 dark:text-emerald-300">
              {stats.closed}
            </p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400">
            <CheckCircle2 className="h-6 w-6" />
          </div>
        </button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tickets by subject, user, email, or message content..."
            className="w-full rounded-lg border border-gray-300 bg-gray-50 py-2 pl-9 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400 dark:focus:bg-gray-750"
          />
        </div>

        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          {[
            { label: 'All', value: '' },
            { label: 'Open', value: 'open' },
            { label: 'Closed', value: 'closed' },
          ].map((tab) => (
            <button
              key={tab.label}
              onClick={() => setStatusFilter(tab.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                statusFilter === tab.value
                  ? 'bg-blue-600 text-white shadow-sm dark:bg-blue-600'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tickets List / Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        {loading && tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Loading support tickets...</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
              <LifeBuoy className="h-7 w-7 text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="mt-3 text-base font-semibold text-gray-900 dark:text-gray-100">
              No tickets found
            </h3>
            <p className="mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">
              {search || statusFilter
                ? 'Try adjusting your search query or status filter.'
                : 'No support requests have been submitted yet.'}
            </p>
            {(search || statusFilter) && (
              <button
                onClick={() => {
                  setSearch('');
                  setStatusFilter('');
                }}
                className="mt-4 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-400">
                <tr>
                  <th className="px-6 py-3">Ticket ID</th>
                  <th className="px-6 py-3">User / Submitter</th>
                  <th className="px-6 py-3">Subject & Message</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {tickets.map((ticket) => {
                  const isOpen = ticket.status === 'open';
                  const isUpdating = updatingId === ticket.id;

                  return (
                    <tr
                      key={ticket.id}
                      className="transition-colors hover:bg-gray-50/75 dark:hover:bg-gray-750/50"
                    >
                      {/* Ticket ID */}
                      <td className="whitespace-nowrap px-6 py-4 font-mono text-xs font-semibold text-gray-700 dark:text-gray-300">
                        #{ticket.id}
                      </td>

                      {/* Submitter */}
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                            {(ticket.user_name || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-gray-100">
                              {ticket.user_name || 'Anonymous User'}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {ticket.user_email || '—'}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Subject & Message */}
                      <td className="max-w-md px-6 py-4">
                        <p className="font-semibold text-gray-900 dark:text-gray-100">
                          {ticket.subject}
                        </p>
                        <p className="line-clamp-2 mt-0.5 text-xs text-gray-600 dark:text-gray-400">
                          {ticket.message}
                        </p>
                      </td>

                      {/* Date */}
                      <td className="whitespace-nowrap px-6 py-4 text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(ticket.created_at)}
                      </td>

                      {/* Status */}
                      <td className="whitespace-nowrap px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                            isOpen
                              ? 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-950/40 dark:text-amber-400 dark:ring-amber-500/30'
                              : 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-500/30'
                          }`}
                        >
                          {isOpen ? (
                            <Clock className="h-3 w-3" />
                          ) : (
                            <Check className="h-3 w-3" />
                          )}
                          {isOpen ? 'Open' : 'Closed'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="whitespace-nowrap px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedTicket(ticket)}
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-650"
                            title="View ticket details"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </button>

                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleStatusToggle(ticket)}
                            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium shadow-sm transition disabled:opacity-50 ${
                              isOpen
                                ? 'bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-650 dark:hover:bg-emerald-700'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
                            }`}
                            title={isOpen ? 'Mark ticket as closed' : 'Reopen ticket'}
                          >
                            {isUpdating ? (
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            ) : isOpen ? (
                              <Check className="h-3.5 w-3.5" />
                            ) : (
                              <RotateCcw className="h-3.5 w-3.5" />
                            )}
                            {isOpen ? 'Close' : 'Reopen'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ticket Details Modal */}
      {selectedTicket && (
        <Modal
          title={`Ticket #${selectedTicket.id}`}
          wide
          onClose={() => setSelectedTicket(null)}
        >
          <div className="flex flex-col gap-5">
            {/* Modal Header details */}
            <div className="flex flex-col gap-3 rounded-lg border border-gray-100 bg-gray-50 p-4 dark:border-gray-700/60 dark:bg-gray-750/50 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-400" />
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {selectedTicket.user_name || 'Anonymous User'}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <Mail className="h-3.5 w-3.5 text-gray-400" />
                  <span>{selectedTicket.user_email || 'No email provided'}</span>
                </div>
              </div>

              <div className="flex flex-col items-start gap-1.5 sm:items-end">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    selectedTicket.status === 'open'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                  }`}
                >
                  {selectedTicket.status === 'open' ? (
                    <Clock className="h-3.5 w-3.5" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  {selectedTicket.status === 'open' ? 'Status: Open' : 'Status: Closed'}
                </span>

                <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Submitted: {formatDate(selectedTicket.created_at)}</span>
                </div>
              </div>
            </div>

            {/* Subject */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Subject
              </label>
              <h3 className="mt-1 text-lg font-bold text-gray-900 dark:text-gray-100">
                {selectedTicket.subject}
              </h3>
            </div>

            {/* Message Body */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Message Content
              </label>
              <div className="mt-1.5 whitespace-pre-wrap rounded-lg border border-gray-200 bg-white p-4 font-normal text-sm leading-relaxed text-gray-800 shadow-inner dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
                {selectedTicket.message}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between border-t border-gray-200 pt-4 dark:border-gray-700">
              <button
                type="button"
                disabled={updatingId === selectedTicket.id}
                onClick={() => handleStatusToggle(selectedTicket)}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${
                  selectedTicket.status === 'open'
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {updatingId === selectedTicket.id ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : selectedTicket.status === 'open' ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
                {selectedTicket.status === 'open' ? 'Mark as Resolved / Closed' : 'Reopen Ticket'}
              </button>

              <button
                type="button"
                onClick={() => setSelectedTicket(null)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Close Window
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
