import { matchPath, matchRoutes } from 'react-router'

export interface AdminPathCandidate {
  path: string
}

function patternScore(pattern: string): number {
  return pattern
    .split('/')
    .filter(Boolean)
    .reduce((score, segment) => score + 1000 + (segment === '*' ? 1 : segment.startsWith(':') ? 10 : 100), 0)
}

export function findAdminRouteMatch<T extends AdminPathCandidate>(candidates: readonly T[], pathname: string): T | undefined {
  const routes = candidates.map((candidate, index) => ({ id: String(index), path: candidate.path }))
  const match = matchRoutes(routes, pathname)?.at(-1)
  return match ? candidates[Number(match.route.id)] : undefined
}

export function findBestAdminPath<T extends AdminPathCandidate>(candidates: readonly T[], pathname: string): T | undefined {
  const routeMatch = findAdminRouteMatch(candidates, pathname)
  if (routeMatch)
    return routeMatch

  return candidates
    .map(candidate => ({ candidate, match: matchPath({ path: candidate.path, end: false }, pathname) }))
    .filter(result => result.match !== null)
    .sort((left, right) => {
      const matchedLength = right.match!.pathname.length - left.match!.pathname.length
      if (matchedLength !== 0)
        return matchedLength
      const specificity = patternScore(right.candidate.path) - patternScore(left.candidate.path)
      if (specificity !== 0)
        return specificity
      return right.candidate.path.length - left.candidate.path.length
    })
    .at(0)
    ?.candidate
}
