// Навигация на MongoDB и PostgreSQL с подключением к БД
const dbInput = document.getElementById('dbName');
const mongoBtn = document.getElementById('MongoDbButton');
const pgBtn = document.getElementById('PostgresSQLButton');

// Выполняет POST-запрос к /api/{type}/connect/{dbName}
async function connectDb(type, dbName) {
  const response = await fetch(`/api/${type}/connect/${encodeURIComponent(dbName)}`, {
    method: 'POST'
  });
  const result = await response.json();
  if (result.status !== 'success') {
    throw new Error(result.message || 'Не удалось подключиться');
  }
}

// Переходит на страницу после успешного подключения
function goTo(page, type) {
  const name = dbInput.value.trim();
  if (!name) {
    return alert('Укажите имя базы данных');
  }
  connectDb(type, name)
    .then(() => {
      window.location.href = `${page}.html?db=${encodeURIComponent(name)}`;
    })
    .catch(err => {
      alert('Ошибка подключения: ' + err.message);
    });
}

mongoBtn.addEventListener('click',  () => goTo('mongo',    'mongo'));
pgBtn.addEventListener('click',    () => goTo('postgres','postgres'));
