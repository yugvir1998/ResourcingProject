-- Set fte_percentage to 5 for allocations to exploration_staging ventures
UPDATE allocations a
SET fte_percentage = 5
FROM ventures v
WHERE a.venture_id = v.id
  AND v.status = 'exploration_staging'
  AND a.fte_percentage > 5;
