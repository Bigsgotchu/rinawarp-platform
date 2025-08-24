import React from 'react';
import { render, screen } from '@testing-library/react';
import { Testimonials } from '../Testimonials';
import { testimonials } from '../../data/testimonials';

describe('Testimonials', () => {
  it('renders testimonials correctly', () => {
    render(<Testimonials testimonials={testimonials} />);
    
    // Check if the section title is rendered
    expect(screen.getByText('What Our Customers Say')).toBeInTheDocument();
    
    // Check if all testimonials are rendered
    testimonials.forEach((testimonial) => {
      expect(screen.getByText(testimonial.content)).toBeInTheDocument();
      expect(screen.getByText(testimonial.name)).toBeInTheDocument();
      expect(screen.getByText(testimonial.role)).toBeInTheDocument();
      expect(screen.getByText(testimonial.company)).toBeInTheDocument();
    });
  });

  it('renders avatars when provided', () => {
    render(<Testimonials testimonials={testimonials} />);
    
    testimonials.forEach((testimonial) => {
      if (testimonial.avatar) {
        const avatar = screen.getByAltText(testimonial.name);
        expect(avatar).toBeInTheDocument();
        expect(avatar).toHaveAttribute('src', testimonial.avatar);
      }
    });
  });
});
