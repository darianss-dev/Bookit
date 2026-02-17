import { useState, useEffect } from 'react';
import { REFERRAL_SOURCES, GENDERS, ETHNICITIES, GENRES, SOURCES } from '../constants';

const EMPTY = {
  title: '', author_name: '', author_gender: '', author_ethnicity: '',
  genre: '', page_count: '', series_name: '', series_order: '',
  date_read: '', blurb: '', referral_source: '', is_recommended: false, source: 'Manual',
};

export default function BookForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState({ ...EMPTY, ...initial });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setForm({ ...EMPTY, ...initial });
  }, [initial]);

  const set = (field) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [field]: val }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { setError('Title is required.'); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        ...form,
        page_count: form.page_count ? Number(form.page_count) : null,
        series_order: form.series_order ? Number(form.series_order) : null,
        is_recommended: form.is_recommended ? 1 : 0,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const field = (label, node, hint) => (
    <div className="form-group">
      <label>{label}</label>
      {node}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );

  const input = (f, type = 'text', extra = {}) => (
    <input type={type} value={form[f] ?? ''} onChange={set(f)} {...extra} />
  );

  const select = (f, opts, placeholder = '— select —') => (
    <select value={form[f] ?? ''} onChange={set(f)}>
      <option value="">{placeholder}</option>
      {opts.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );

  return (
    <form className="book-form" onSubmit={handleSubmit}>
      <h2>{initial?.id ? 'Edit Book' : 'Add Book'}</h2>
      {error && <p className="form-error">{error}</p>}

      <div className="form-row">
        {field('Title *', input('title'), null)}
        {field('Author Name', input('author_name'), null)}
      </div>

      <div className="form-row">
        {field('Author Gender', select('author_gender', GENDERS), null)}
        {field('Author Ethnicity', select('author_ethnicity', ETHNICITIES), null)}
      </div>

      <div className="form-row">
        {field('Genre', select('genre', GENRES), null)}
        {field('Page Count', input('page_count', 'number', { min: 1 }), null)}
      </div>

      <div className="form-row">
        {field('Series Name', input('series_name'), null)}
        {field('Order in Series', input('series_order', 'number', { min: 0, step: 0.5 }), 'e.g. 1, 2, 2.5')}
      </div>

      <div className="form-row">
        {field('Date Read', input('date_read', 'date'), null)}
        {field('Source', select('source', SOURCES), null)}
      </div>

      {field('Referral Source', select('referral_source', REFERRAL_SOURCES, '— how did you find it? —'), null)}

      {field('One-sentence Blurb',
        <textarea rows={2} maxLength={300} value={form.blurb ?? ''} onChange={set('blurb')}
          placeholder="Your personal one-sentence take on this book…" />,
        `${(form.blurb || '').length}/300`
      )}

      <div className="form-group checkbox-group">
        <label>
          <input type="checkbox" checked={!!form.is_recommended} onChange={set('is_recommended')} />
          &nbsp; Add to my Recommendations list
        </label>
      </div>

      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving…' : initial?.id ? 'Save Changes' : 'Add Book'}
        </button>
      </div>
    </form>
  );
}
