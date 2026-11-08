import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CoverSelectorCarousel } from '../../src/features/catalog/components/CoverSelectorCarousel';
import { CoverStorageService } from '../../src/features/catalog/services/coverStorageService';
import { CatalogResolver } from '../../src/features/catalog/services/catalogResolver';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///data/user/0/com.bacibooks/files/',
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true }),
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  copyAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn().mockResolvedValue({
    uri: 'file:///cache/manipulated.webp',
    width: 800,
    height: 1200,
  }),
  SaveFormat: {
    WEBP: 'webp',
    JPEG: 'jpeg',
    PNG: 'png',
  },
}));

describe('CoverSelector & CoverStorageService Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('CoverStorageService', () => {
    it('obtiene el directorio persistente de portadas asegurando su existencia', async () => {
      const dir = await CoverStorageService.getCoversDirectory();
      expect(dir).toBe('file:///data/user/0/com.bacibooks/files/covers/');
      expect(FileSystem.getInfoAsync).toHaveBeenCalledWith(
        'file:///data/user/0/com.bacibooks/files/covers/'
      );
    });

    it('optimiza una portada a WebP y la almacena en el directorio permanente', async () => {
      const sourcePhotoUri = 'file:///camera/photo123.jpg';
      const isbn13 = '9788445000663';

      const savedUri = await CoverStorageService.optimizeAndSaveCover(
        sourcePhotoUri,
        isbn13
      );

      expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
        sourcePhotoUri,
        [{ resize: { width: 800 } }],
        { compress: 0.85, format: 'webp' }
      );

      expect(FileSystem.copyAsync).toHaveBeenCalledWith({
        from: 'file:///cache/manipulated.webp',
        to: expect.stringContaining('file:///data/user/0/com.bacibooks/files/covers/cover_9788445000663_'),
      });

      expect(savedUri).toContain('covers/cover_9788445000663_');
      expect(savedUri).toMatch(/\.webp$/);
    });
  });

  describe('CatalogResolver fetchAlternativeCovers', () => {
    it('deduplica portadas y posiciona la portada exacta del ISBN en primer lugar', async () => {
      const initialCovers = [
        'https://books.google.com/books/content?id=exact_isbn_cover&printsec=frontcover',
        'https://covers.openlibrary.org/b/id/12345-L.jpg',
        'https://covers.openlibrary.org/b/id/12345-L.jpg', // duplicada
      ];

      const covers = await CatalogResolver.fetchAlternativeCovers(
        '9788445000663',
        undefined,
        undefined,
        'Debolsillo',
        initialCovers
      );

      // Deduplica la portada repetida
      expect(covers.filter((c) => c === 'https://covers.openlibrary.org/b/id/12345-L.jpg')).toHaveLength(1);
      // La portada exacta del ISBN va en primer lugar (#1)
      expect(covers[0]).toBe('https://books.google.com/books/content?id=exact_isbn_cover&printsec=frontcover');
      // No satura la lista con más de 5 portadas
      expect(covers.length).toBeLessThanOrEqual(5);
    });
  });

  describe('CoverSelectorCarousel Component', () => {
    const mockCovers = [
      'https://covers.openlibrary.org/b/id/111-L.jpg',
      'https://covers.openlibrary.org/b/id/222-L.jpg',
      'file:///covers/cover_foto.webp',
    ];

    it('renderiza la lista de portadas y dispara onSelectCover al pulsar una opcion', () => {
      const handleSelect = jest.fn();
      const handleCapture = jest.fn();

      const { getByLabelText, getByText } = render(
        <CoverSelectorCarousel
          covers={mockCovers}
          selectedCoverUri={mockCovers[0]}
          onSelectCover={handleSelect}
          onCaptureManualCover={handleCapture}
        />
      );

      expect(getByText('Edición y portada')).toBeTruthy();
      expect(getByText('3 encontradas')).toBeTruthy();
      expect(getByText('Tu foto')).toBeTruthy();

      // Pulsar en la segunda portada
      const secondCover = getByLabelText('Seleccionar portada 2');
      fireEvent.press(secondCover);
      expect(handleSelect).toHaveBeenCalledWith('https://covers.openlibrary.org/b/id/222-L.jpg');

      // Pulsar en el boton de fotografiar portada
      const captureBtn = getByLabelText('Fotografiar portada de tu libro');
      fireEvent.press(captureBtn);
      expect(handleCapture).toHaveBeenCalledTimes(1);
    });

    it('muestra estado vacio amigable cuando no hay portadas remotas disponibles', () => {
      const handleSelect = jest.fn();
      const handleCapture = jest.fn();

      const { getByText } = render(
        <CoverSelectorCarousel
          covers={[]}
          selectedCoverUri={null}
          onSelectCover={handleSelect}
          onCaptureManualCover={handleCapture}
        />
      );

      expect(getByText('0 encontradas')).toBeTruthy();
      expect(getByText('Sin portadas web')).toBeTruthy();
    });
  });
});
