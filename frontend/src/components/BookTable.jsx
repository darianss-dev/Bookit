import { useState } from 'react';
import { api } from '../api';

const STAR = '★';
const STAR_O = '☆';

export default function BookTable({ books, onEdit, onDelete, onToggleRecommend, sort, onSort }) {
  const [deleting, setDeleting] = useState(null);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this book?')) return;
    setDeleting(id);
    try { await onDelete(id); } finally { setDeleting(null); }
  };

  const SortHeader = ({ col, label }) => {
    const active = sort.col === col;
    const nextOrder = active && sort.order === 'asc' ? 'desc' : 'asc';
    return (
      <th
        className={`sortable ${active ? 'sorted-' + sort.order : ''}`}
        onClick={() => onSort({ col, order: nextOrder })}
      >
        {label} {active ? (sort.order === 'asc' ? '↑' : '↓') : ''}
      </th>
    );
  };

  if (books.length === 0) {
    return <p className="empty">No books found. Add your first book!</p>;
  }

  return (
    <div className="table-wrapper">
      <table className="book-table">
        <thead>
          <tr>
            <th></th>
            <SortHeader col="title" label="Title" />
            <SortHeader col="author_name" label="Author" />
            <th>Gender</th>
            <th>Ethnicity</th>
            <SortHeader col="genre" label="Genre" />
            <SortHeader col="page_count" label="Pages" />
            <th>Series</th>
            <SortHeader col="date_read" label="Date Read" />
            <th>Source</th>
            <th>Referral</th>
            <th>Blurb</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {books.map((b) => (
            <tr key={b.id} className={b.is_recommended ? 'recommended' : ''}>
              <td className="recommend-cell">
                <button
                  className="star-btn"
                  title={b.is_recommended ? 'Remove from recommendations' : 'Add to recommendations'}
                  onClick={() => onToggleRecommend(b.id)}
                >
                  {b.is_recommended ? STAR : STAR_O}
                </button>
              </td>
              <td className="title-cell">
                <strong>{b.title}</strong>
              </td>
              <td>{b.author_name || '—'}</td>
              <td>
                <span className={`badge gender-${(b.author_gender || 'unknown').toLowerCase().replace(/[^a-z]/g, '')}`}>
                  {b.author_gender || '—'}
                </span>
              </td>
              <td>
                <span className={`badge eth-${(b.author_ethnicity || 'unknown').toLowerCase()}`}>
                  {b.author_ethnicity || '—'}
                </span>
              </td>
              <td>{b.genre || '—'}</td>
              <td>{b.page_count || '—'}</td>
              <td className="series-cell">
                {b.series_name
                  ? `${b.series_name}${b.series_order != null ? ` #${b.series_order}` : ''}`
                  : '—'}
              </td>
              <td>{b.date_read ? b.date_read.slice(0, 10) : '—'}</td>
              <td>
                <span className={`badge source-${(b.source || '').toLowerCase()}`}>
                  {b.source || '—'}
                </span>
              </td>
              <td>{b.referral_source || '—'}</td>
              <td className="blurb-cell" title={b.blurb}>{b.blurb || '—'}</td>
              <td className="actions-cell">
                <button className="btn-icon" onClick={() => onEdit(b)} title="Edit">✏️</button>
                <button
                  className="btn-icon btn-delete"
                  onClick={() => handleDelete(b.id)}
                  disabled={deleting === b.id}
                  title="Delete"
                >🗑️</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
