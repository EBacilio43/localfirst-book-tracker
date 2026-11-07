import React from 'react';
import { render, cleanup } from '@testing-library/react-native';
import { AiDetectiveSkeleton } from '../../src/shared/components/Skeleton';

describe('AiDetectiveSkeleton - Componente Visual', () => {
  afterEach(() => {
    cleanup();
  });

  it('se renderiza correctamente con testID ai-detective-skeleton', () => {
    const { getByTestId } = render(<AiDetectiveSkeleton />);
    expect(getByTestId('ai-detective-skeleton')).toBeTruthy();
  });

  it('renderiza la cantidad de tarjetas indicada por el prop count', () => {
    const { getByTestId } = render(<AiDetectiveSkeleton count={4} />);
    const container = getByTestId('ai-detective-skeleton');
    expect(container.props.children).toHaveLength(4);
  });
});
