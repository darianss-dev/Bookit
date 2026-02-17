export default function RecommendationList({ books, onEdit, onToggleRecommend }) {
  const recommended = books.filter((b) => b.is_recommended);

  if (recommended.length === 0) {
    return (
      <div className="empty-recs">
        <p>No recommendations yet.</p>
        <p>Click the ☆ star next to any book in the Books tab to add it here.</p>
      </div>
    );
  }

  // Group by genre
  const byGenre = recommended.reduce((acc, b) => {
    const g = b.genre || 'Uncategorized';
    if (!acc[g]) acc[g] = [];
    acc[g].push(b);
    return acc;
  }, {});

  return (
    <div className="recommendation-list">
      <h2>My Recommendations ({recommended.length})</h2>
      {Object.entries(byGenre).sort(([a], [b]) => a.localeCompare(b)).map(([genre, bks]) => (
        <section key={genre} className="rec-genre-section">
          <h3>{genre}</h3>
          <div className="rec-cards">
            {bks.map((b) => (
              <div key={b.id} className="rec-card">
                <div className="rec-card-header">
                  <div>
                    <strong className="rec-title">{b.title}</strong>
                    {b.series_name && (
                      <span className="rec-series">
                        {b.series_name}{b.series_order != null ? ` #${b.series_order}` : ''}
                      </span>
                    )}
                  </div>
                  <button
                    className="star-btn starred"
                    title="Remove from recommendations"
                    onClick={() => onToggleRecommend(b.id)}
                  >★</button>
                </div>
                <p className="rec-author">
                  {b.author_name || 'Unknown author'}
                  {b.author_gender ? ` · ${b.author_gender}` : ''}
                  {b.author_ethnicity ? ` · ${b.author_ethnicity}` : ''}
                </p>
                {b.blurb && <p className="rec-blurb">"{b.blurb}"</p>}
                <div className="rec-meta">
                  {b.date_read && <span>Read: {b.date_read.slice(0, 10)}</span>}
                  {b.referral_source && <span>via {b.referral_source}</span>}
                  {b.page_count && <span>{b.page_count} pp.</span>}
                </div>
                <button className="btn-link" onClick={() => onEdit(b)}>Edit</button>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
