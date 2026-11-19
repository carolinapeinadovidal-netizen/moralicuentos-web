-- OPCIONAL: datos de ejemplo para ver el CRM con contenido.
-- Todos llevan "(ejemplo)" en el nombre o el título para borrarlos fácilmente desde la app.

insert into public.cuentos (id, titulo, edad, valor, estado, descripcion, sinopsis, actividad, pregunta, moraleja, vistas, creado) values
('11111111-1111-4111-8111-111111111111','Pepita Calabacita y la noche de las luces (ejemplo)','4–6','Valentía','publicado',
 'Pepita descubre que tener miedo no impide ser valiente.',
 'En la noche de Halloween, Pepita se disfraza de calabacita y se adentra en el bosque para devolver una luz perdida a los duendes. Por el camino aprende que la valentía es seguir adelante aunque se sienta miedo.',
 'Dibuja tu propia calabaza con una carita que dé confianza.','¿Qué hizo Pepita cuando sintió miedo?','Ser valiente es seguir adelante con el corazón, aunque tiemblen las piernas.',128,'2026-10-20'),
('22222222-2222-4222-8222-222222222222','Pepita Estrellita de Oriente (ejemplo)','2–4','Generosidad','publicado',
 'Una estrellita que aprende a compartir su luz en Navidad.',
 'Pepita, vestida de estrellita, reparte su brillo entre los animalitos del establo para que ninguno pase frío.',
 'Comparte hoy un juguete con alguien y cuéntalo en casa.','¿Con quién compartió su luz Pepita?','Cuando compartes, tu luz brilla más.',94,'2026-11-02'),
('33333333-3333-4333-8333-333333333333','Pepita Margarita Creciente (ejemplo)','6–9','Cuidado','borrador',
 'Una margarita que crece cuando alguien la cuida.',
 'Pepita cuida una margarita pequeñita y descubre que todo lo que se cuida con paciencia crece.','','','',0,'2026-11-10')
on conflict (id) do nothing;

select public.guardar_familia('{"id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","nombre":"Familia García (ejemplo)","email":"garcia@ejemplo.com","etapa":"suscriptora","personaje":"cuestionario enviado","notas":"Datos de ejemplo.","proximo":"2026-11-18","alta":"2026-10-25","hijos":[{"nombre":"Lucía","edad":3},{"nombre":"Mateo","edad":6}],"favoritos":["22222222-2222-4222-8222-222222222222","11111111-1111-4111-8111-111111111111"],"interacciones":[{"fecha":"2026-11-05","tipo":"Email","texto":"Cuestionario de personaje enviado"}]}');
select public.guardar_familia('{"id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","nombre":"Familia Ruiz (ejemplo)","email":"ruiz@ejemplo.com","etapa":"registrada","proximo":"2026-11-20","alta":"2026-11-08","hijos":[{"nombre":"Daniel","edad":5}],"favoritos":["11111111-1111-4111-8111-111111111111"],"interacciones":[{"fecha":"2026-11-08","tipo":"Nota","texto":"Se registró desde la web"}]}');
select public.guardar_familia('{"id":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","nombre":"Familia Soler (ejemplo)","email":"soler@ejemplo.com","etapa":"interesada","proximo":"2026-11-16","alta":"2026-11-14","hijos":[{"nombre":"Irene","edad":2}],"interacciones":[{"fecha":"2026-11-14","tipo":"WhatsApp","texto":"Pidió información sobre la suscripción"}]}');
select public.guardar_familia('{"id":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","nombre":"Familia Navarro (ejemplo)","email":"navarro@ejemplo.com","etapa":"inactiva","alta":"2026-09-30","hijos":[{"nombre":"Pau","edad":8}]}');
