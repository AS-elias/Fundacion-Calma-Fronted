export interface Mensaje {
  texto: string;
  hora: string;
  enviadoPorMi: boolean;
  tipo?: string;
  archivoUrl?: string;
  leido?: boolean;
}

export interface ContactoChat {
  id: number;
  nombre: string;
  iniciales: string;
  colorBg: string;
  enLinea: boolean;
  mensajesSinLeer: number;
  mensajes: Mensaje[];
  esGrupo?: boolean;
  participantes?: any[];
  avatarUrl?: string;
}
