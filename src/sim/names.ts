import { type Random, randomInt } from '../core/rng'
import type { Village } from './world'

// A village's name is a root and an ending, both by number: each language spells them its own way,
// so the same village is Birchwick in English and Берёзовка in Russian
export const NAME_ROOTS = 40
export const NAME_ENDINGS = 10

// Every village of the map gets a root of its own, and any ending
export function nameVillages(villages: Village[], random: Random): void {
  const roots = Array.from({ length: NAME_ROOTS }, (_, i) => i)
  for (let i = roots.length - 1; i > 0; i--) {
    const j = randomInt(random, 0, i)
    ;[roots[i], roots[j]] = [roots[j], roots[i]]
  }
  villages.forEach((village, i) => {
    village.name = roots[i % NAME_ROOTS] * NAME_ENDINGS + randomInt(random, 0, NAME_ENDINGS - 1)
  })
}
