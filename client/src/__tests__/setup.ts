/**
 * CONFIGURACION DE LAS PRUEBAS
 * ---------------------------------------------------------------------------
 * Los polyfills de aqui existen porque jsdom imita al navegador, pero no
 * replica TODAS sus APIs. No son parches del codigo de la app: son
 * el andamiaje que el entorno de pruebas necesita para ejecutar lo mismo
 * que el navegador.
 */
import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

/*
 * ResizeObserver
 *
 * Recharts lo usa dentro de ResponsiveContainer para detectar el ancho del
 * contenedor y redibujar el grafico. jsdom no lo implementa.
 *
 * El stub no hace nada a proposito: en las pruebas lo que se verifica es la
 * logica (porcentajes, saldo, rutas), no el pixel final de un SVG. Escribiendo
 * siempre el mismo tamano, el grafico se monta con dimensiones fijas y ya no
 * se redibuja en un bucle infinito.
 */
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;

/*
 * La busqueda de elementos de Recharts usa SVG, y jsdom no implementa
 * SVGElement.getBBox: lo devuelve undefined y el calculo del grafico revienta.
 * Se define con un valor minimo razonable.
 */
if (typeof SVGElement !== 'undefined' && !('getBBox' in SVGElement.prototype)) {
  // El cast es necesario porque getBBox pertenece a SVGSVGElement y a los
  // elementos de grafico, no a SVGElement, que es el unico tipo disponible
  // aqui de forma general.
  (SVGElement.prototype as unknown as Record<string, unknown>)['getBBox'] =
    function getBBox() {
      return { x: 0, y: 0, width: 100, height: 100 };
    };
}

/** Silencia el aviso de act() de React: es ruido, no un fallo real. */
vi.spyOn(console, 'warn').mockImplementation(() => {});
