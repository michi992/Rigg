export class ProjectStorage {
  constructor(onStatus, onError, key = 'current') {
    this.onStatus = onStatus;
    this.onError = onError;
    this.db = null;
    this.timer = null;
    this.key = key;
  }
  async load() {
    try {
      this.db = await new Promise((resolve, reject) => {
        const request = indexedDB.open('dewald-rig-studio', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('projects');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      return await new Promise((resolve, reject) => {
        const request = this.db.transaction('projects').objectStore('projects').get(this.key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch {
      this.onStatus('Bitte Projektdatei speichern', false);
      return null;
    }
  }
  schedule(snapshot) {
    clearTimeout(this.timer);
    this.onStatus('Änderungen werden gesichert …');
    this.timer = setTimeout(() => {
      if (!this.db) {
        this.onStatus('Bitte Projektdatei speichern', false);
        return;
      }
      try {
        const transaction = this.db.transaction('projects', 'readwrite');
        transaction.objectStore('projects').put(snapshot(), this.key);
        transaction.oncomplete = () => this.onStatus('Lokal gespeichert');
        transaction.onerror = () => {
          this.onStatus('Bitte Projektdatei speichern', false);
          this.onError(transaction.error);
        };
      } catch (error) {
        this.onStatus('Bitte Projektdatei speichern', false);
        this.onError(error);
      }
    }, 650);
  }
}
