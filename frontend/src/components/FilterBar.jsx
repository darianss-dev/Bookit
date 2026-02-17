import { GENDERS, ETHNICITIES, SOURCES } from '../constants';

export default function FilterBar({ filters, onChange, genres }) {
  const set = (key) => (e) => onChange({ ...filters, [key]: e.target.value });

  return (
    <div className="filter-bar">
      <input
        className="filter-search"
        type="search"
        placeholder="Search title or author…"
        value={filters.search || ''}
        onChange={set('search')}
      />

      <select value={filters.genre || ''} onChange={set('genre')}>
        <option value="">All genres</option>
        {genres.map((g) => <option key={g} value={g}>{g}</option>)}
      </select>

      <select value={filters.source || ''} onChange={set('source')}>
        <option value="">All sources</option>
        {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>

      <select value={filters.recommended || ''} onChange={set('recommended')}>
        <option value="">All books</option>
        <option value="1">Recommended only</option>
      </select>

      <button
        className={`filter-reset ${Object.values(filters).some(Boolean) ? 'active' : ''}`}
        onClick={() => onChange({ search: '', genre: '', source: '', recommended: '' })}
      >
        Clear filters
      </button>
    </div>
  );
}
