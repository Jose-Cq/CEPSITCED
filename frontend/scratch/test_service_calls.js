import { obtenerTestimoniosLanding } from '../../backend/services/landingService.js';
import { obtenerEspecialistasLanding } from '../../backend/services/especialistasService.js';

async function test() {
  console.log('Testing obtenerTestimoniosLanding()...');
  const testimonies = await obtenerTestimoniosLanding();
  console.log('Testimonies returned:', testimonies);

  console.log('\nTesting obtenerEspecialistasLanding()...');
  const specialists = await obtenerEspecialistasLanding();
  console.log('Specialists returned:', specialists);
}

test();
