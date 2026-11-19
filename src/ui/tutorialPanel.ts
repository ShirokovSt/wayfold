import { onLanguageChange, t } from '../i18n'
import type { Cell, World } from '../sim/world'
import { STEPS } from '../tutorial/tutorial'
import { button, element } from './dom'

// The tutorial's text in the corner of the board: one step at a time, moving on when the player does what it asks
export class TutorialPanel {
  private step = -1 // -1 while there is no tutorial
  private readonly root = element('div', 'tutorial')
  private readonly contents = element('div', 'tutorial-contents')
  private readonly toggle = button('', () => this.setFolded(!this.folded), 'tutorial-toggle')
  private folded = false
  private touch = false

  constructor(
    stage: HTMLElement,
    private readonly onSkip: () => void,
  ) {
    this.root.hidden = true
    this.root.append(this.toggle, this.contents)
    stage.append(this.root)
    onLanguageChange(() => this.active && this.render())
  }

  get active(): boolean {
    return this.step >= 0
  }

  start(): void {
    this.show(0)
  }

  setTouch(touch: boolean): void {
    if (touch === this.touch) return
    this.touch = touch
    if (this.active) this.render()
  }

  fold(): void {
    if (this.touch) this.setFolded(true)
  }

  stop(): void {
    this.step = -1
    this.root.hidden = true
  }

  showOnBoard(visible: boolean): void {
    this.root.hidden = !visible || !this.active
  }

  // Runs every frame
  update(world: World, paused: boolean): void {
    if (this.active && STEPS[this.step].done?.(world, paused)) this.show(this.step + 1)
  }

  // The villages and the den the current step talks about, to be ringed on the board
  marked(world: World): Cell[] {
    if (!this.active) return []
    const step = STEPS[this.step]
    const villages = step.marked.map((id) => world.villages[id].cell)
    return step.den ? [...villages, ...world.lairs.map((lair) => lair.cell)] : villages
  }

  private show(step: number): void {
    this.step = Math.min(step, STEPS.length - 1)
    this.setFolded(false)
    this.render()
    this.root.hidden = false
  }

  private setFolded(folded: boolean): void {
    this.folded = folded
    this.root.classList.toggle('folded', folded)
    this.toggle.ariaExpanded = String(!folded)
  }

  private render(): void {
    const step = STEPS[this.step]
    const actions = element('div', 'actions')
    if (!step.done) actions.append(button(t().next, () => this.show(this.step + 1), 'primary'))
    actions.append(button(t().skipTutorial, this.onSkip))
    const strings = t()
    const title = `${strings.step} ${this.step + 1} / ${STEPS.length}`
    const touchSteps: Partial<Record<typeof step.id, string>> = strings.touchTutorialSteps
    this.toggle.textContent = title
    this.contents.replaceChildren(
      element('p', 'step', title),
      element('p', '', (this.touch && touchSteps[step.id]) || strings.tutorialSteps[step.id]),
      actions,
    )
  }
}
