export const GROUP_ORDER = ['cour', 'td', 'tp', 'exams', 'record', 'drive', 'other'];
const GROUP_PREFIX = { Cours: 'cour', TD: 'td', TP: 'tp', Examens: 'exams', Record: 'record' };

export function groupKey(resource) {
  const prefix = resource.label?.split(' — ')[0];
  return GROUP_PREFIX[prefix] ?? (resource.kind === 'drive' || resource.kind === 'video' ? 'drive' : 'other');
}

export function groupResources(resources) {
  const buckets = Object.fromEntries(GROUP_ORDER.map((key) => [key, []]));
  for (const r of resources) buckets[groupKey(r)].push(r);
  return GROUP_ORDER.map((key) => [key, buckets[key]]).filter(([, list]) => list.length > 0);
}
