import { Input, Button, Chip, Pagination, Tabs, Tab, Select, SelectItem, Card, CardBody, Tooltip, Divider } from '@heroui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ArrowUp, ArrowDown, Minus, Search, Info, Edit3, X } from 'lucide-react';
import { computeCumulativeScores } from '../lib/categories';

function sortedWithRank(teams, sortOrder = 'desc') {
  const arr = [...(teams || [])].map((t) => ({ ...t, _score: Number(t.score) || 0 }));
  arr.sort((a, b) => {
    const scoreCompare = sortOrder === 'asc' 
      ? a._score - b._score 
      : b._score - a._score;
    if (scoreCompare !== 0) return scoreCompare;
    return (a.created_at || '').localeCompare(b.created_at || '');
  });
  return arr.map((t, i) => ({ ...t, rank: i + 1 }));
}

/**
 * Inner ranked list renderer — extracted so it can be reused in both
 * cumulative and per-category views.
 */
function RankedList({
  teams,
  sortOrder,
  bigScreen,
  canJudge,
  onScoreChange,
  scoreKey = 'score',
  label,
}) {
  const [delta, setDelta] = useState({});
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const prevRanks = useRef({});
  const [movements, setMovements] = useState({});

  const rowsPerPage = bigScreen ? 8 : 10;

  const rows = useMemo(() => {
    const arr = [...(teams || [])].map((t) => ({
      ...t,
      _score: Number(t[scoreKey]) || 0,
    }));
    arr.sort((a, b) => {
      const cmp = sortOrder === 'asc' ? a._score - b._score : b._score - a._score;
      if (cmp !== 0) return cmp;
      return (a.created_at || '').localeCompare(b.created_at || '');
    });
    return arr.map((t, i) => ({ ...t, rank: i + 1 }));
  }, [teams, sortOrder, scoreKey]);

  const filteredRows = useMemo(
    () => rows.filter((t) => t.name.toLowerCase().includes(search.toLowerCase())),
    [rows, search],
  );

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredRows.slice(start, start + rowsPerPage);
  }, [filteredRows, page, rowsPerPage]);

  const totalPages = Math.ceil(filteredRows.length / rowsPerPage);

  useEffect(() => {
    const newMovements = {};
    rows.forEach((t) => {
      const prev = prevRanks.current[t.id];
      if (prev !== undefined && prev !== t.rank) {
        newMovements[t.id] = prev > t.rank ? 'up' : 'down';
      }
      prevRanks.current[t.id] = t.rank;
    });

    if (Object.keys(newMovements).length > 0) {
      setMovements((p) => ({ ...p, ...newMovements }));
      const timer = setTimeout(() => setMovements({}), 3000);
      return () => clearTimeout(timer);
    }
  }, [rows]);

  const handleAdd = (team) => {
    const d = Number(delta[team.id]) || 0;
    if (d === 0) return;
    onScoreChange(team.id, d);
    setDelta((prev) => ({ ...prev, [team.id]: '' }));
  };

  const textSize = bigScreen ? 'text-3xl md:text-5xl' : 'text-base';
  const rowClass = bigScreen
    ? 'flex items-center gap-6 md:gap-12 py-6 px-8 rounded-xl bg-content1/50 border border-content2 shadow-sm'
    : 'flex items-center gap-4 py-3 border-b border-default-100 hover:bg-default-50 transition-colors px-2';

  return (
    <div aria-label={label || 'Leaderboard'} className={bigScreen ? 'space-y-4 max-w-5xl mx-auto' : 'space-y-1'}>
      <div className="flex justify-between items-center mb-4">
        <Input
          placeholder="Search team..."
          value={search}
          onValueChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          startContent={<Search className="text-default-400" size={16} />}
          className="max-w-xs"
          isClearable
          onClear={() => setSearch('')}
        />
        {filteredRows.length > 0 && (
          <span className="text-small text-default-400">
            Showing {paginatedRows.length} of {filteredRows.length}
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <div className={bigScreen ? '' : 'min-w-[640px]'}>
          <AnimatePresence mode="popLayout">
            {paginatedRows.map((t) => {
              const move = movements[t.id];
              return (
                <motion.div
                  key={t.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    backgroundColor:
                      move === 'up'
                        ? 'var(--heroui-success-50)'
                        : move === 'down'
                          ? 'var(--heroui-danger-50)'
                          : '',
                  }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  className={rowClass}
                >
                  <div
                    className={`flex items-center justify-center w-12 md:w-20 font-bold ${textSize} ${bigScreen ? 'text-default-400' : ''}`}
                  >
                    {t.rank}
                  </div>

                  <div className="flex flex-col items-center justify-center w-8">
                    {move === 'up' && (
                      <ArrowUp className="text-success animate-bounce" size={bigScreen ? 32 : 16} />
                    )}
                    {move === 'down' && (
                      <ArrowDown className="text-danger animate-bounce" size={bigScreen ? 32 : 16} />
                    )}
                    {!move && bigScreen && <Minus className="text-default-200" size={24} />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <span className={`font-bold block ${textSize} truncate`}>{t.name}</span>
                    {bigScreen && t.description && (
                      <p className="text-default-500 text-lg">{t.description}</p>
                    )}
                  </div>

                  <div
                    className={`w-24 md:w-40 text-right font-mono font-bold ${textSize} ${move === 'up' ? 'text-success' : move === 'down' ? 'text-danger' : 'text-primary'}`}
                  >
                    {(Number(t[scoreKey]) || 0).toLocaleString()}
                  </div>

                  {canJudge && !bigScreen && (
                    <div className="flex gap-2 items-center ml-4">
                      <Input
                        type="number"
                        size="sm"
                        variant="bordered"
                        classNames={{ input: 'w-16 text-right', base: 'w-24' }}
                        placeholder="0"
                        value={delta[t.id] ?? ''}
                        onValueChange={(v) => setDelta((p) => ({ ...p, [t.id]: v }))}
                      />
                      <Button
                        size="sm"
                        isIconOnly
                        color="primary"
                        variant="flat"
                        onPress={() => handleAdd(t)}
                      >
                        +
                      </Button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {filteredRows.length === 0 && (
        <div className="text-center py-8 text-default-400">No teams found</div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center mt-4 pt-4 border-t border-divider">
          <Pagination
            total={totalPages}
            page={page}
            onChange={setPage}
            size={bigScreen ? 'lg' : 'md'}
            showControls
            color={bigScreen ? 'secondary' : 'primary'}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Per-category view: lets users pick a category and shows per-category scores.
 * Judges can add points to the selected category.
 * Managers can edit the selected category.
 * All viewers see category info when categories are enabled.
 */
function CategoryView({
  teams,
  categories,
  categoryScores,
  sortOrder,
  bigScreen,
  canJudge,
  canManage,
  onCategoryScoreChange,
  onEditCategory,
}) {
  const [selectedCatId, setSelectedCatId] = useState('');

  // Auto-select first category
  useEffect(() => {
    if (!selectedCatId && categories.length > 0) {
      setSelectedCatId(categories[0].id);
    }
  }, [categories, selectedCatId]);

  const selectedCat = categories.find((c) => c.id === selectedCatId);

  // Build team list with per-category score
  const teamsWithCatScore = useMemo(() => {
    if (!selectedCatId) return teams.map((t) => ({ ...t, catScore: 0 }));
    return teams.map((t) => {
      const cs = categoryScores.find(
        (s) => s.team_id === t.id && s.category_id === selectedCatId,
      );
      return { ...t, catScore: Number(cs?.raw_points) || 0 };
    });
  }, [teams, categoryScores, selectedCatId]);

  const handleCatScoreChange = useCallback(
    (teamId, delta) => {
      if (selectedCatId) {
        onCategoryScoreChange?.(teamId, selectedCatId, delta);
      }
    },
    [selectedCatId, onCategoryScoreChange],
  );

  if (categories.length === 0) {
    return (
      <div className="text-center py-8 text-default-400">
        No categories have been created yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Category selector chips */}
      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <Button
            key={c.id}
            size="sm"
            variant={selectedCatId === c.id ? 'solid' : 'bordered'}
            color={selectedCatId === c.id ? 'primary' : 'default'}
            onPress={() => setSelectedCatId(c.id)}
            className="h-auto py-1.5"
          >
            <span>{c.name}</span>
            <Chip size="sm" variant="flat" color={selectedCatId === c.id ? 'default' : 'primary'} className="ml-1 scale-90">
              ×{c.points_multiplier}
            </Chip>
          </Button>
        ))}
      </div>

      {/* Selected category detail card */}
      {selectedCat && (
        <Card className="bg-gradient-to-r from-primary-50/50 to-secondary-50/50 border border-primary-100">
          <CardBody className="py-3 px-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-semibold text-medium">{selectedCat.name}</h4>
                  <Chip
                    size="sm"
                    variant="flat"
                    color="primary"
                    startContent={<X size={0} />}
                  >
                    ×{selectedCat.points_multiplier} multiplier
                  </Chip>
                </div>
                {selectedCat.description && (
                  <p className="text-small text-default-600 leading-relaxed">
                    {selectedCat.description}
                  </p>
                )}
                <p className="text-tiny text-default-400">
                  Each point in this category contributes <strong className="text-default-600">×{selectedCat.points_multiplier}</strong> to the cumulative leaderboard.
                </p>
              </div>
              {canManage && onEditCategory && (
                <Button
                  size="sm"
                  variant="light"
                  isIconOnly
                  onPress={() => onEditCategory(selectedCat)}
                  aria-label="Edit category"
                >
                  <Edit3 size={14} />
                </Button>
              )}
            </div>
          </CardBody>
        </Card>
      )}

      <RankedList
        teams={teamsWithCatScore}
        sortOrder={sortOrder}
        bigScreen={bigScreen}
        canJudge={canJudge}
        onScoreChange={handleCatScoreChange}
        scoreKey="catScore"
        label={`Category: ${selectedCat?.name || ''}`}
      />
    </div>
  );
}

/**
 * Main Leaderboard component.
 * When categoriesEnabled=true and categories exist, renders HeroUI Tabs
 * with "Cumulative" and "By Category" sub-tabs.
 */
export default function Leaderboard({
  teams = [],
  canJudge,
  onScoreChange,
  bigScreen = false,
  sortOrder = 'desc',
  // Category props (optional — backward compatible)
  categories = [],
  categoryScores = [],
  categoriesEnabled = false,
  canManage = false,
  onCategoryScoreChange,
  onEditCategory,
}) {
  // Compute cumulative scores from categories when enabled
  const cumulativeTeams = useMemo(() => {
    if (!categoriesEnabled || categories.length === 0) return teams;
    const totals = computeCumulativeScores(categories, categoryScores);
    return teams.map((t) => {
      const catTotal = totals.get(t.id) || 0;
      const baseScore = Number(t.score) || 0;
      return { ...t, score: baseScore + catTotal };
    });
  }, [teams, categories, categoryScores, categoriesEnabled]);

  // Categories not enabled or none exist — classic view
  if (!categoriesEnabled || categories.length === 0) {
    return (
      <RankedList
        teams={teams}
        sortOrder={sortOrder}
        bigScreen={bigScreen}
        canJudge={canJudge}
        onScoreChange={onScoreChange}
      />
    );
  }

  return (
    <div className="space-y-3">
      {/* Category overview visible to ALL viewers (including big screen) */}
      <Card className="bg-gradient-to-r from-primary-50/40 to-secondary-50/40 border border-primary-100/60">
        <CardBody className="py-2.5 px-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-semibold text-default-600 ${bigScreen ? 'text-lg' : 'text-small'}`}>Scoring Categories:</span>
            {categories.map((c) => (
              <Tooltip key={c.id} content={c.description || c.name}>
                <Chip
                  size={bigScreen ? 'md' : 'sm'}
                  variant="flat"
                  color="primary"
                >
                  {c.name}
                  <span className="text-primary-400 ml-1">×{c.points_multiplier}</span>
                </Chip>
              </Tooltip>
            ))}
          </div>
        </CardBody>
      </Card>

      <Tabs
        aria-label="Leaderboard views"
        variant="solid"
        color="primary"
        size={bigScreen ? 'lg' : 'md'}
        classNames={{
          tabList: 'gap-2',
        }}
      >
        <Tab key="cumulative" title="Cumulative">
          <div className="mt-3">
            <RankedList
              teams={cumulativeTeams}
              sortOrder={sortOrder}
              bigScreen={bigScreen}
              canJudge={canJudge}
              onScoreChange={onScoreChange}
            />
          </div>
        </Tab>
        <Tab key="by-category" title="By Category">
          <div className="mt-3">
            <CategoryView
              teams={teams}
              categories={categories}
              categoryScores={categoryScores}
              sortOrder={sortOrder}
              bigScreen={bigScreen}
              canJudge={canJudge}
              canManage={canManage}
              onCategoryScoreChange={onCategoryScoreChange}
              onEditCategory={onEditCategory}
            />
          </div>
        </Tab>
      </Tabs>
    </div>
  );
}
