import {
  cleanCsvIsbn,
  parseGoodreadsOrCustomCsv,
  exportBooksToCsv,
} from '../../src/features/cloud-sync/services/csvPortabilityService';

describe('CSV Portability Service (Import/Export)', () => {
  describe('cleanCsvIsbn', () => {
    it('remueve el envoltorio de Excel de Goodreads (="...") y devuelve el ISBN-13 limpio', () => {
      const result = cleanCsvIsbn('="9788437604947"');
      expect(result).toBe('9788437604947');
    });

    it('elimina guiones, comillas y espacios en el ISBN', () => {
      const result = cleanCsvIsbn('="978-84-376-0494-7"');
      expect(result).toBe('9788437604947');
    });

    it('convierte un ISBN-10 válido al estándar ISBN-13', () => {
      // 0306406152 -> 9780306406157
      const result = cleanCsvIsbn('="0306406152"');
      expect(result).toBe('9780306406157');
    });

    it('convierte un ISBN-10 con digito verificador X a ISBN-13', () => {
      // 0-8044-2957-X -> 9780804429573
      const result = cleanCsvIsbn('="0-8044-2957-X"');
      expect(result).toBe('9780804429573');
    });

    it('devuelve null si el valor es nulo, indefinido o vacío', () => {
      expect(cleanCsvIsbn(null)).toBeNull();
      expect(cleanCsvIsbn(undefined)).toBeNull();
      expect(cleanCsvIsbn('')).toBeNull();
      expect(cleanCsvIsbn('   ')).toBeNull();
      expect(cleanCsvIsbn('=""')).toBeNull();
    });

    it('devuelve null para códigos con longitud incorrecta o no válidos', () => {
      expect(cleanCsvIsbn('="12345"')).toBeNull();
      expect(cleanCsvIsbn('texto-invalido')).toBeNull();
    });
  });

  describe('parseGoodreadsOrCustomCsv', () => {
    const goodreadsCsvSample = [
      'Title,Author,Additional Authors,ISBN,ISBN13,My Rating,Average Rating,Publisher,Binding,Number of Pages,Year Published,Original Publication Year,Date Read,Date Added,Bookshelves,Bookshelves with positions,Exclusive Shelf,My Review,Spoiler,Private Notes,Read Count,Owned Copies',
      '"El Señor de los Anillos: La Comunidad del Anillo","J.R.R. Tolkien","","=""8445000668""","=""9788445000663""",5,4.55,"Minotauro","Tapa blanda",560,1954,1954,2024/02/15,2024/01/10,"fantasia",1,read,"Maravilloso libro",,,1,1',
      '"Dune, Primera Parte","Frank Herbert","","=""0441172717""","=""9780441172719""",0,4.25,"Ace","Paperback",0,1965,1965,,2024/02/01,"scifi",2,currently-reading,"",,,1,0',
      '"Cien Años de Soledad","Gabriel García Márquez","","","=""9780307474728""",0,4.10,"Debolsillo","Bolsillo",496,1967,1967,,2024/03/01,"favoritos",3,to-read,"",,,0,1',
    ].join('\n');

    it('parsea un CSV exportado de Goodreads reconociendo campos entre comillas y comas internas', () => {
      const parsed = parseGoodreadsOrCustomCsv(goodreadsCsvSample);

      expect(parsed.totalRowsRead).toBe(3);
      expect(parsed.skippedDuplicatesCount).toBe(0);
      expect(parsed.importedCandidates).toHaveLength(3);

      const firstBook = parsed.importedCandidates[0];
      expect(firstBook.title).toBe('El Señor de los Anillos: La Comunidad del Anillo');
      expect(firstBook.authors).toEqual(['J.R.R. Tolkien']);
      expect(firstBook.isbn13).toBe('9788445000663');
      expect(firstBook.publisher).toBe('Minotauro');
      expect(firstBook.pageCount).toBe(560);
      expect(firstBook.currentStatus).toBe('LEIDO');
      expect(firstBook.rating).toBe(5);
      expect(firstBook.finishedAtLocalDate).toBe('2024-02-15');
    });

    it('asigna 200 paginas por defecto si pageCount es 0 o no esta definido para evitar division por cero', () => {
      const parsed = parseGoodreadsOrCustomCsv(goodreadsCsvSample);
      const secondBook = parsed.importedCandidates[1];

      expect(secondBook.title).toBe('Dune, Primera Parte');
      expect(secondBook.currentStatus).toBe('LEYENDO');
      expect(secondBook.pageCount).toBe(200);
      expect(secondBook.rating).toBeNull();
    });

    it('omite libros cuyo ISBN ya existe en la biblioteca y cuenta los duplicados', () => {
      const existingIsbns = new Set<string>(['9788445000663']);
      const parsed = parseGoodreadsOrCustomCsv(goodreadsCsvSample, existingIsbns);

      expect(parsed.totalRowsRead).toBe(3);
      expect(parsed.skippedDuplicatesCount).toBe(1);
      expect(parsed.importedCandidates).toHaveLength(2);
      expect(parsed.importedCandidates.map((b) => b.isbn13)).toEqual([
        '9780441172719',
        '9780307474728',
      ]);
    });

    it('descarta duplicados repetidos dentro del mismo archivo CSV', () => {
      const duplicateCsv = [
        'Title,Author,ISBN13,Exclusive Shelf',
        '"Fahrenheit 451","Ray Bradbury","=""9788445000663""",read',
        '"Fahrenheit 451 Copia","Ray Bradbury","=""9788445000663""",to-read',
      ].join('\n');

      const parsed = parseGoodreadsOrCustomCsv(duplicateCsv);
      expect(parsed.totalRowsRead).toBe(2);
      expect(parsed.skippedDuplicatesCount).toBe(1);
      expect(parsed.importedCandidates).toHaveLength(1);
      expect(parsed.importedCandidates[0].title).toBe('Fahrenheit 451');
    });

    it('parsea correctamente un CSV en espanol con encabezados personalizados', () => {
      const spanishCsv = [
        '"Título","Autor","ISBN","Editorial","Páginas","Estado","Calificación"',
        '"Rayuela","Julio Cortázar","9788437604947","Cátedra","728","Leído","5"',
        '"Ficciones","Jorge Luis Borges","9788420658421","Alianza","224","Leyendo","4"',
        '"Pedro Páramo","Juan Rulfo","9788437604183","Cátedra","130","Por leer",""',
      ].join('\r\n');

      const parsed = parseGoodreadsOrCustomCsv(spanishCsv);
      expect(parsed.totalRowsRead).toBe(3);
      expect(parsed.importedCandidates).toHaveLength(3);

      expect(parsed.importedCandidates[0]).toEqual({
        title: 'Rayuela',
        authors: ['Julio Cortázar'],
        isbn13: '9788437604947',
        publisher: 'Cátedra',
        pageCount: 728,
        currentStatus: 'LEIDO',
        rating: 5,
        finishedAtLocalDate: null,
      });

      expect(parsed.importedCandidates[1].currentStatus).toBe('LEYENDO');
      expect(parsed.importedCandidates[2].currentStatus).toBe('POR_LEER');
      expect(parsed.importedCandidates[2].rating).toBeNull();
    });

    it('maneja de forma segura un contenido CSV vacio o solo con encabezados', () => {
      const emptyResult = parseGoodreadsOrCustomCsv('');
      expect(emptyResult.importedCandidates).toEqual([]);
      expect(emptyResult.totalRowsRead).toBe(0);

      const headerOnly = parseGoodreadsOrCustomCsv('Title,Author,ISBN13\n');
      expect(headerOnly.importedCandidates).toEqual([]);
      expect(headerOnly.totalRowsRead).toBe(0);
    });
  });

  describe('exportBooksToCsv', () => {
    it('genera un CSV formateado con encabezados amigables en espanol y comillas de escape', () => {
      const booksToExport = [
        {
          title: 'Don Quijote de la Mancha, Volumen "Especial"',
          authorsJson: JSON.stringify(['Miguel de Cervantes Saavedra']),
          isbn13: '9788424115166',
          publisher: 'Espasa',
          pageCount: 864,
          currentStatus: 'LEIDO',
          rating: 5,
        },
        {
          title: 'Crónica de una muerte anunciada',
          authorsJson: JSON.stringify(['Gabriel García Márquez']),
          isbn13: '9788497592437',
          publisher: 'Debolsillo',
          pageCount: 144,
          currentStatus: 'LEYENDO',
          rating: null,
        },
      ];

      const csvString = exportBooksToCsv(booksToExport);
      const lines = csvString.split('\r\n');

      expect(lines[0]).toBe('"Título","Autor","ISBN","Editorial","Páginas","Estado","Calificación"');
      expect(lines[1]).toContain('""Especial""');
      expect(lines[1]).toContain('"Leído"');
      expect(lines[1]).toContain('"5"');
      expect(lines[2]).toContain('"Leyendo"');
      expect(lines[2]).toContain('""'); // calificacion vacia
    });
  });
});
