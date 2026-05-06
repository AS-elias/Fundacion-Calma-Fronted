export type TipoNotificacion = 'comunicado' | 'alerta';

export interface Notificacion {
  id: number;
  titulo: string;
  mensaje: string;
  tipo: TipoNotificacion;
  fecha: string;
  leido: boolean;
}