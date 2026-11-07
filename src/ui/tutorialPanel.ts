import { onLanguageChange, t } from '../i18n'
import type { Cell, World } from '../sim/world'
import { STEPS } from '../tutorial/tutorial'
import { button, element } from './dom'

// The tutorial's text in the corner of the board: one step at a time, moving on when the player does what it asks
export class TutorialPanel {
  private step = -1 // -1 while there is no tutorial
  private readonly root = element('div', 'tutorial')

  constructor(
    stage: HTMLElement,
    private readonly onSkip: () => void,
  ) {
    this.root.hidden = true
    stage.append(this.root)
    onLanguageChange(() => this.active && this.render())
  }

  get active(): boolean {
    return this.step >= 0
  }

  start(): void {
    this.show(0)
  }

  stop(): void {
    this.step = -1
    this.root.hidden = true
  }

  // Runs every frame
  update(world: World, paused: boolean): void {
    if (this.active && STEPS[this.step].done?.(world, paused)) this.show(this.step + 1)
  }

  // The villages the current step talks about, to be ringed on the board
  marked(world: World): Cell[] {
    return this.active ? STEPS[this.step].marked.map((id) => world.villages[id].cell) : []
  }

  private show(step: number): void {
    this.step = Math.min(step, STEPS.length - 1)
    this.render()
    this.root.hidden = false
  }

  private render(): void {
    const step = STEPS[this.step]
    const actions = element('div', 'actions')
    if (!step.done) actions.append(button(t().next, () => this.show(this.step + 1), 'primary'))
    actions.append(button(t().skipTutorial, this.onSkip))
    this.root.replaceChildren(
      element('p', 'step', `${t().step} ${this.step + 1} / ${STEPS.length}`),
      element('p', '', t().tutorialSteps[step.id]),
      actions,
    )
  }
}
