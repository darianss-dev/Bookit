import { useState, useEffect, useCallback } from 'react';
import { api } from './api';
import BookTable from './components/BookTable';
import BookForm from './components/BookForm';
import FilterBar from './components/FilterBar';
import RecommendationList from './components/RecommendationList';
import SyncBar from './components/SyncBar';
import './App.css';

const TABS = ['Books', 'Recommendations'];

export default function App() {
  const [tab, setTab] = useState('Books');
  const [books, setBooks] = useState([]);
  const [genres, setGenres] = useState([]);
  const [filters, setFilters] = useState({ search: '', genre: '', source: '', recommended: '' });
  const [sort, setSort] = useState({ col: 'date_read', order: 'desc' });
  const [editBook, setEditBook] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadBooks = useCallback(async () => {
    setLoading(true);
    try {
      const params = { ...filters, sort: sort.col, order: sort.order };
      const data = await api.books.list(params);
      setBooks(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters, sort]);

  const loadGenres = useCallback(async () => {
    const data = await api.books.genres().catch(() => []);
    setGenres(data);
  }, []);

  useEffect(() => { loadBooks(); }, [loadBooks]);
  useEffect(() => { loadGenres(); }, [loadGenres]);

  const handleSave = async (data) => {
    if (editBook?.id) {
      const updated = await api.books.update(editBook.id, data);
      setBooks((prev) => prev.map((b) => b.id === updated.id ? updated : b));
    } else {
      await api.books.create(data);
      await loadBooks();
      loadGenres();
    }
    setShowForm(false);
    setEditBook(null);
  };

  const handleEdit = (book) => {
    setEditBook(book);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    await api.books.delete(id);
    setBooks((prev) => prev.filter((b) => b.id !== id));
  };

  const handleToggleRecommend = async (id) => {
    const result = await api.books.toggleRecommend(id);
    setBooks((prev) =>
      prev.map((b) => b.id === result.id ? { ...b, is_recommended: result.is_recommended } : b)
    );
  };

  const openAdd = () => {
    setEditBook(null);
    setShowForm(true);
  };

  const recommendedCount = books.filter((b) => b.is_recommended).length;

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-brand">
          <span className="app-logo">📚</span>
          <h1>Bookit</h1>
        </div>
        <SyncBar onSyncComplete={loadBooks} />
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t}
            className={"tab" + (tab === t ? " active" : "")}
            onClick={() => setTab(t)}
          >
            {t}
            {t === 'Recommendations' && recommendedCount > 0 && (
              <span className="tab-badge">{recommendedCount}</span>
            )}
          </button>
        ))}
      </nav>

      <main className="main-content">
        {tab === 'Books' && (
          <>
            <div className="toolbar">
              <FilterBar filters={filters} onChange={setFilters} genres={genres} />
              <button className="btn-primary add-btn" onClick={openAdd}>+ Add Book</button>
            </div>

            {loading ? (
              <p className="loading">Loading...</p>
            ) : error ? (
              <p className="err">Error: {error}</p>
            ) : (
              <BookTable
                books={books}
                sort={sort}
                onSort={setSort}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onToggleRecommend={handleToggleRecommend}
              />
            )}
          </>
        )}

        {tab === 'Recommendations' && (
          <RecommendationList
            books={books}
            onEdit={handleEdit}
            onToggleRecommend={handleToggleRecommend}
          />
        )}
      </main>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <BookForm
              initial={editBook || {}}
              onSave={handleSave}
              onCancel={() => { setShowForm(false); setEditBook(null); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
