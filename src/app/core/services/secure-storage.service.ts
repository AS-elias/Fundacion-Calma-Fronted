import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SecureStorageService {
  
  // Clave secreta estática (solo para ofuscar, no es seguridad criptográfica fuerte, pero frena XSS simple)
  private readonly SECRET_KEY = 'C4lm4_F0und4t10n_K3y';

  constructor() { }

  public setItem(key: string, value: string): void {
    const encryptedKey = this.encrypt(key);
    const encryptedValue = this.encrypt(value);
    localStorage.setItem(encryptedKey, encryptedValue);
  }

  public getItem(key: string): string | null {
    const encryptedKey = this.encrypt(key);
    const encryptedValue = localStorage.getItem(encryptedKey);
    if (!encryptedValue) {
      return null;
    }
    
    try {
      return this.decrypt(encryptedValue);
    } catch (e) {
      return null;
    }
  }

  public removeItem(key: string): void {
    const encryptedKey = this.encrypt(key);
    localStorage.removeItem(encryptedKey);
  }

  public clear(): void {
    localStorage.clear();
  }

  // --- Funciones de Ofuscación Ligera ---
  // Nota: Para una seguridad real, se debería usar CryptoJS, pero esto previene 
  // que los datos sean legibles a simple vista o por scripts genéricos.

  private encrypt(txt: string): string {
    return btoa(
      encodeURIComponent(txt).replace(/%([0-9A-F]{2})/g,
        function toSolidBytes(match, p1) {
          return String.fromCharCode(Number('0x' + p1));
        })
    );
  }

  private decrypt(txt: string): string {
    return decodeURIComponent(
      atob(txt).split('').map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join('')
    );
  }
}
