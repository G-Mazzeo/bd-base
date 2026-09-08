export interface ServiceDef {
  /** Clave usada en la CLI y como profile de docker compose. */
  key: string;
  label: string;
  container: string;
  ports: number[];
  /** Líneas de conexión que se muestran al levantar el servicio. */
  connection: () => string[];
  /** Verifica conectividad real. Devuelve un detalle; lanza error si falla. */
  check: () => Promise<string>;
}
