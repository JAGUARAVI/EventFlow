import { supabase, withRetry } from './supabase';

/**
 * Fetch all categories for an event.
 */
export async function fetchCategories(eventId) {
  return supabase
    .from('categories')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at');
}

/**
 * Create a new category (manager-only via RLS).
 */
export async function createCategory(eventId, { name, description = '', points_multiplier = 1.0 }, userId) {
  return withRetry(() =>
    supabase
      .from('categories')
      .insert({
        event_id: eventId,
        name,
        description,
        points_multiplier,
        created_by: userId,
      })
      .select()
      .single()
  );
}

/**
 * Update a category (manager-only via RLS).
 */
export async function updateCategory(categoryId, fields) {
  return withRetry(() =>
    supabase
      .from('categories')
      .update(fields)
      .eq('id', categoryId)
      .select()
      .single()
  );
}

/**
 * Delete a category (manager-only via RLS). Cascades to category_scores.
 */
export async function deleteCategory(categoryId) {
  return withRetry(() =>
    supabase
      .from('categories')
      .delete()
      .eq('id', categoryId)
  );
}

/**
 * Fetch all category scores for an event.
 */
export async function fetchCategoryScores(eventId) {
  return supabase
    .from('category_scores')
    .select('*')
    .eq('event_id', eventId);
}

/**
 * Upsert a per-team per-category score (judge-level via RLS).
 * Uses the unique constraint on (team_id, category_id).
 */
export async function upsertCategoryScore(eventId, teamId, categoryId, rawPoints, userId) {
  return withRetry(() =>
    supabase
      .from('category_scores')
      .upsert(
        {
          event_id: eventId,
          team_id: teamId,
          category_id: categoryId,
          raw_points: rawPoints,
          changed_by: userId,
        },
        { onConflict: 'team_id,category_id' }
      )
      .select()
      .single()
  );
}

/**
 * Compute cumulative scores for all teams by summing (raw_points * multiplier) per category.
 * Returns a Map<teamId, number>.
 */
export function computeCumulativeScores(categories, categoryScores) {
  const totals = new Map();
  const catMap = new Map(categories.map(c => [c.id, c]));
  for (const cs of categoryScores) {
    const cat = catMap.get(cs.category_id);
    if (!cat) continue;
    const multiplier = Number(cat.points_multiplier) || 1;
    const pts = (Number(cs.raw_points) || 0) * multiplier;
    totals.set(cs.team_id, (totals.get(cs.team_id) || 0) + pts);
  }
  return totals;
}
