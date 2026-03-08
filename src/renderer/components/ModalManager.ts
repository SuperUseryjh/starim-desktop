export class ModalManager {
  private overlay: HTMLElement;
  private modal: HTMLElement;
  private titleEl: HTMLElement;
  private bodyEl: HTMLElement;

  constructor() {
    this.overlay = document.getElementById('modal-overlay')!;
    this.modal = document.getElementById('modal')!;
    this.titleEl = document.getElementById('modal-title')!;
    this.bodyEl = document.getElementById('modal-body')!;
    
    document.getElementById('modal-close')?.addEventListener('click', () => this.hide());
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.hide();
    });
  }

  show(title: string, content: string): void {
    this.titleEl.textContent = title;
    this.bodyEl.innerHTML = content;
    this.overlay.classList.remove('hidden');
  }

  hide(): void {
    this.overlay.classList.add('hidden');
  }

  getBodyElement(): HTMLElement {
    return this.bodyEl;
  }
}

export const modal = new ModalManager();
