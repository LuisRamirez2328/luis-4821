/**
 * Polyfills del entorno, no parches de la app: jsdom imita al navegador pero no
 * replica todas sus APIs, y sin esto los graficos no se montan.
 */
import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// ResizeObserver: lo usa ResponsiveContainer de Recharts para medir el ancho y
// redibujar. El stub no hace nada a proposito, porque lo que se prueba es la
// logica y no el pixel final de un SVG; con tamano fijo el grafico tampoco se
// redibuja en un bucle infinito.
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
