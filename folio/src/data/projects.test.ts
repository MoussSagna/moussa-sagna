import { describe, expect, it } from 'vitest';
import { PROJECTS, adjacentProjects, findProject, projectNumber } from './projects';

describe('données des projets', () => {
  it('utilise des slugs uniques et compatibles avec une URL', () => {
    const slugs = PROJECTS.map((project) => project.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) {
      expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('retrouve un projet par son slug', () => {
    expect(findProject('racine-eyewear')?.name).toBe('RACINE EYEWEAR');
    expect(findProject('inconnu')).toBeUndefined();
    expect(findProject(undefined)).toBeUndefined();
  });

  it('numérote les projets sur deux chiffres', () => {
    expect(projectNumber(PROJECTS[0]!.slug)).toBe('01');
    expect(projectNumber(PROJECTS[2]!.slug)).toBe('03');
  });

  it('boucle sur la liste pour les projets précédent et suivant', () => {
    const first = PROJECTS[0]!;
    const last = PROJECTS[PROJECTS.length - 1]!;
    expect(adjacentProjects(first.slug)?.previous.slug).toBe(last.slug);
    expect(adjacentProjects(last.slug)?.next.slug).toBe(first.slug);
    expect(adjacentProjects('inconnu')).toBeUndefined();
  });
});
