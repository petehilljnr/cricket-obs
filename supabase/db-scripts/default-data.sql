do $$
declare
  v_kings uuid;
  v_shirley uuid;
begin
  -- --------------------------------------------------------
  -- Ensure Teams exist (idempotent)
  -- --------------------------------------------------------
  select id into v_kings
  from public.teams
  where name = 'Kings HS 1st XI'
  limit 1;

  if v_kings is null then
    insert into public.teams (name, short_name)
    values ('Kings HS 1st XI', 'KINGS')
    returning id into v_kings;
  end if;

  select id into v_shirley
  from public.teams
  where name = 'Shirley Boys HS 1st XI'
  limit 1;

  if v_shirley is null then
    insert into public.teams (name, short_name)
    values ('Shirley Boys HS 1st XI', 'SBHS')
    returning id into v_shirley;
  end if;

  -- --------------------------------------------------------
  -- Insert Kings HS 1st XI players (idempotent)
  -- --------------------------------------------------------
  insert into public.players (team_id, full_name, display_name)
  select v_kings, n, n
  from unnest(array[
    'Rhys Milmine',
    'Ryder Guthrie',
    'Max Poulter',
    'Ethan Blair',
    'Blake Broom',
    'Levi Simpson',
    'Evan Lowry',
    'Utah Thompson',
    'Ethan McBride-Aburn',
    'Ollie Hill',
    'Jack Proctor',
    'Zach Scott'
  ]) as n
  where not exists (
    select 1
    from public.players p
    where p.team_id = v_kings
      and p.full_name = n
  );

  -- --------------------------------------------------------
  -- Insert Shirley Boys HS 1st XI players (idempotent)
  -- --------------------------------------------------------
  insert into public.players (team_id, full_name, display_name)
  select v_shirley, n, n
  from unnest(array[
    'Jamie Newitt-Isaks',
    'Jake Wilson',
    'Sam Singh',
    'Douglas Bongartz',
    'Liam Stocker',
    'Mikael Hansrod',
    'Noah Townrow',
    'Quade Hamilton',
    'Ankit Kafle',
    'Lucas McLeod',
    'Cooper Hemmingway',
    'Taylor Collins'
  ]) as n
  where not exists (
    select 1
    from public.players p
    where p.team_id = v_shirley
      and p.full_name = n
  );

  raise notice 'Seed complete. Kings team id: %, Shirley team id: %', v_kings, v_shirley;
end $$;