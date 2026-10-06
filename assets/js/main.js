/* EAP Care — общие скрипты сайта.
   Задачи:
   1) непрозрачная sticky-шапка после прокрутки;
   2) мобильное раскрывающееся меню;
   3) фиксированная кнопка «Вернуться наверх»;
   4) однократное появление декоративного фланца в блоке C;
   5) один открытый ответ в блоке вопросов.
   Всё остальное на страницах работает без этого скрипта. */
(function () {
  'use strict';

  var header   = document.querySelector('.site-header');
  var toggle   = document.querySelector('.site-nav-toggle');
  var panel    = document.getElementById('site-nav-panel');
  var toTop    = document.querySelector('.to-top');
  var topEl    = document.getElementById('top');

  var reduceMotion = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : { matches: false };

  var SCROLL_HEADER = 24;  /* порог класса is-scrolled */
  /* Граница мобильной шапки. Раньше совпадала с 900px, но с кнопкой
     «Оставить заявку» строка перестала помещаться уже от 1180px, и CSS
     перешёл на этот порог (см. @media в шапке). Логика меню та же,
     меняется только число, чтобы CSS и скрипт решали одно и то же. */
  var MOBILE_MAX    = 1179;

  var ticking = false;

  function prefersReduced() {
    return !!(reduceMotion && reduceMotion.matches);
  }

  /* ---------- Мобильное меню ---------- */

  function isMenuOpen() {
    return !!(panel && panel.classList.contains('is-open'));
  }

  function setMenu(open) {
    if (!panel || !toggle) return;
    panel.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function closeMenu(restoreFocus) {
    if (!panel || !toggle) return;
    var hadFocusInside = panel.contains(document.activeElement);
    var wasOpen = isMenuOpen();
    setMenu(false);
    /* Фокус возвращаем на кнопку только если он был внутри панели.
       При уходе по ссылке фокус не трогаем, чтобы не мешать переходу. */
    if (wasOpen && hadFocusInside && restoreFocus !== false) {
      toggle.focus();
    }
  }

  if (toggle && panel) {
    header && header.classList.add('menu-ready');

    toggle.addEventListener('click', function () {
      setMenu(!isMenuOpen());
    });

    panel.addEventListener('click', function (e) {
      var link = e.target && e.target.closest ? e.target.closest('a') : null;
      if (link) closeMenu(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' || e.key === 'Esc') {
        if (isMenuOpen()) closeMenu(true);
      }
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > MOBILE_MAX) {
        /* Desktop: сбрасываем мобильное состояние, nav и так виден. */
        if (isMenuOpen()) setMenu(false);
      } else {
        /* Ушли в mobile, панель скрыта: фокус из неё переносим на кнопку. */
        if (!isMenuOpen() && panel.contains(document.activeElement)) {
          toggle.focus();
        }
      }
    });
  }

  /* ---------- Кнопка «Вернуться наверх» ---------- */

  function showToTop() {
    /* Порог появления — высота окна. */
    return window.pageYOffset > window.innerHeight;
  }

  function focusTop() {
    if (topEl && typeof topEl.focus === 'function') {
      try {
        topEl.focus({ preventScroll: true });
      } catch (err) {
        topEl.focus();
      }
    }
  }

  if (toTop) {
    document.documentElement.classList.add('to-top-ready');

    toTop.addEventListener('click', function () {
      /* Сначала фокус на видимой шапке, затем прокрутка.
         Кнопка после этого скрывается, но фокус на ней не остаётся. */
      focusTop();
      window.scrollTo({
        top: 0,
        behavior: prefersReduced() ? 'auto' : 'smooth'
      });
    });
  }

  /* ---------- Общее обновление при прокрутке ---------- */

  function apply() {
    var y = window.pageYOffset;

    if (header) {
      if (y > SCROLL_HEADER) {
        header.classList.add('is-scrolled');
      } else {
        header.classList.remove('is-scrolled');
      }
    }

    if (toTop) {
      var visible = showToTop();
      if (visible !== !toTop.hidden) {
        toTop.hidden = !visible;
        /* Кнопку скрыли, а фокус на ней — переносим на шапку. */
        if (!visible && document.activeElement === toTop) {
          focusTop();
        }
      }
    }

    ticking = false;
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(apply);
  }

  /* Начальное состояние: страница могла открыться уже прокрученной
     или прийти сразу по якорю категории. */
  apply();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- Однократное появление фланца ----------
     Изолированный блок: без своих элементов он просто ничего не делает
     (например, на programs.html). Начальное смещение и поворот заданы
     в CSS и включаются только этим классом, поэтому без JS декор
     сразу виден в финальном состоянии. */

  (function decorFlange() {
    var section = document.querySelector('.manifesto');
    var flange  = section && section.querySelector('.manifesto__flange');

    if (!section || !flange) return;
    if (prefersReduced()) return;
    if (typeof window.IntersectionObserver !== 'function') return;

    flange.classList.add('is-pending');
    /* Читаем геометрию, чтобы начальное состояние было засчитано
       до снятия класса — иначе переход может не начаться. */
    flange.getBoundingClientRect();

    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (!entries[i].isIntersecting) continue;
        flange.classList.remove('is-pending');
        io.disconnect();
      }
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });

    io.observe(section);
  })();

  /* ---------- Аккордеон вопросов ----------
     Состояние ведёт нативный details: клик по всей строке, Enter/Space,
     фокус на вопросе и скрытие закрытого ответа из порядка Tab
     работают браузером. Скрипт добавляет только недостающее — одновременно
     открыт максимум один ответ. Второго механизма состояния нет:
     закрытие соседа выполняется той же нативной свойством open.
     Изолированный блок: на страницах без списка вопросов ничего не делает. */

  (function faqSingleOpen() {
    var list = document.querySelector('.faq-mini__list');
    if (!list) return;

    var items = [].slice.call(list.querySelectorAll('details.faq-mini__item'));
    if (!items.length) return;

    items.forEach(function (item) {
      item.addEventListener('toggle', function () {
        if (!item.open) return;
        for (var i = 0; i < items.length; i++) {
          if (items[i] !== item && items[i].open) items[i].open = false;
        }
      });
    });
  })();

  /* ---------- Модальная форма заявки ----------
     Один нативный <dialog> на документ, общий для всех триггеров
     [data-open-request]: кнопка шапки на index.html и на
     programs.html, а будущие CTA страницы программ подключаются тем
     же атрибутом. Окно открывается только по действию пользователя.
     Блокировку страницы за окном, возврат фокуса на вызвавший элемент
     и закрытие по Escape даёт сам showModal(), поэтому ручная ловушка
     Tab не нужна и не написана. Клик по затемнённому фону не
     закрывает форму — такого обработчика здесь нет намеренно.
     Мобильное меню закрывается нажатием его же переключателя, то есть
     через существующий обработчик, а не вторым.
     Серверного endpoint в проекте нет: после валидной попытки форма
     честно сообщает, что онлайн-отправка не подключена, и показывает
     реальные контакты. Успеха не показываем, поля не очищаем, данные
     никуда не отправляем и нигде не сохраняем. */
  (function requestDialog() {
    var dialog = document.querySelector('.request');
    var form = document.querySelector('.request__form');
    if (!dialog || !form) return;

    var title = dialog.querySelector('.request__title');
    var status = dialog.querySelector('.request__status');
    var toggle = document.querySelector('.site-nav-toggle');
    var panel = document.getElementById('site-nav-panel');
    var triggers = Array.prototype.slice.call(document.querySelectorAll('[data-open-request]'));
    var closers = Array.prototype.slice.call(document.querySelectorAll('[data-close-request]'));
    if (!triggers.length) return;

    /* Ограничения длины продублированы в maxlength у полей: это
       клиентская защита от очевидно неверного ввода, а не серверная. */
    var LIMITS = {
      name: 100, company: 150, phone: 40, email: 120, comment: 1500
    };
    /* Проверка простая, маска не ставится: так вставка номера и
       международный формат не ломаются. */
    var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    var ALLOWED_SIZES = ['', 'До 500 человек', '500 – 2 000 человек',
      '2 000 – 10 000 человек', 'Более 10 000 человек'];

    var lastTrigger = null;   /* элемент, открывший окно */
    var savedScroll = 0;      /* позиция страницы до открытия */

    function setError(name, message) {
      var el = form.elements[name];
      var out = document.getElementById('request-error-' + name);
      if (!el || !out) return;
      if (message) {
        el.setAttribute('aria-invalid', 'true');
        out.textContent = message;
      } else {
        el.removeAttribute('aria-invalid');
        out.textContent = '';
      }
    }
    function clearErrors() {
      ['name', 'company', 'phone', 'email', 'size', 'comment']
        .forEach(function (n) { setError(n, ''); });
    }

    /* Клиентская проверка. Возвращает имена полей с ошибками. */
    function validate() {
      var bad = [];

      ['name', 'company', 'phone'].forEach(function (n) {
        var el = form.elements[n];
        if (!el) return;
        var v = el.value.replace(/^\s+|\s+$/g, '');
        if (!v) {
          setError(n, 'Заполните это поле.');
          bad.push(n);
        } else if (v.length > LIMITS[n]) {
          setError(n, 'Не длиннее ' + LIMITS[n] + ' символов.');
          bad.push(n);
        } else {
          setError(n, '');
        }
      });

      var email = form.elements.email;
      if (email) {
        var ev = email.value.replace(/^\s+|\s+$/g, '');
        if (!ev) {
          setError('email', '');
        } else if (ev.length > LIMITS.email) {
          setError('email', 'Не длиннее ' + LIMITS.email + ' символов.');
          bad.push('email');
        } else if (!EMAIL_RE.test(ev)) {
          setError('email', 'Проверьте адрес почты.');
          bad.push('email');
        } else {
          setError('email', '');
        }
      }

      var size = form.elements.size;
      if (size) {
        if (ALLOWED_SIZES.indexOf(size.value) < 0) {
          setError('size', 'Выберите вариант из списка.');
          bad.push('size');
        } else {
          setError('size', '');
        }
      }

      var comment = form.elements.comment;
      if (comment) {
        if (comment.value.length > LIMITS.comment) {
          setError('comment', 'Не длиннее ' + LIMITS.comment + ' символов.');
          bad.push('comment');
        } else {
          setError('comment', '');
        }
      }
      return bad;
    }

    /* Ответ без отправки: endpoint не согласован, поэтому правдивый
       текст вместо «Заявка отправлена». Контакты — существующие. */
    function showStatus() {
      if (!status) return;
      status.textContent = '';
      var strong = document.createElement('strong');
      strong.className = 'request__status-title';
      strong.textContent = 'Онлайн-отправка пока не подключена.';
      var tail = document.createElement('span');
      tail.textContent = ' Свяжитесь с нами по контактам ниже.';
      var list = document.createElement('ul');
      list.className = 'request__status-list';
      var rows = [
        ['Телефон', '8 (908) 688-82-68'],
        ['Почта', 'hr@eapcare.ru'],
        ['Telegram', '@eapcare_hr']
      ];
      rows.forEach(function (row) {
        var li = document.createElement('li');
        var label = document.createElement('span');
        label.className = 'request__status-label';
        label.textContent = row[0] + ': ';
        li.appendChild(label);
        li.appendChild(document.createTextNode(row[1]));
        list.appendChild(li);
      });
      status.appendChild(strong);
      status.appendChild(tail);
      status.appendChild(list);
      status.hidden = false;
    }

    function visible(el) {
      if (!el) return false;
      var r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }

    function open(trigger) {
      if (dialog.open) return;
      lastTrigger = trigger || null;
      savedScroll = window.pageYOffset;
      /* Открытие из мобильного меню: закрываем его тем же переключателем,
         который уже всё это делает. Возврат фокуса после закрытия окна
         пойдёт на этот переключатель, а не на скрытую кнопку меню. */
      if (lastTrigger && panel && panel.contains(lastTrigger) &&
          panel.classList.contains('is-open') && toggle && !toggle.disabled) {
        toggle.click();
      }
      if (status) status.hidden = true;
      if (typeof dialog.showModal === 'function') {
        dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
      /* Фокус на заголовке: форма начинается сверху, мобильная
         клавиатура при этом не вызывается — фокус не на поле ввода. */
      if (title) {
        try { title.focus({ preventScroll: true }); }
        catch (err) { title.focus(); }
      }
    }

    function close() {
      if (!dialog.open) return;
      if (typeof dialog.close === 'function') {
        dialog.close();
      } else {
        dialog.removeAttribute('open');
        onClosed();
      }
    }

    function onClosed() {
      /* Позиция страницы: возвращаем ту же, что была до открытия. */
      if (window.pageYOffset !== savedScroll) window.scrollTo(0, savedScroll);
      var target = null;
      if (visible(lastTrigger)) target = lastTrigger;
      else if (visible(toggle)) target = toggle;
      if (target) {
        try { target.focus({ preventScroll: true }); }
        catch (err) { target.focus(); }
      }
      lastTrigger = null;
    }

    triggers.forEach(function (el) {
      el.addEventListener('click', function () { open(el); });
    });
    closers.forEach(function (el) {
      el.addEventListener('click', function () { close(); });
    });

    /* Снятие ошибки, как только поле исправлено. */
    ['name', 'company', 'phone', 'email', 'size', 'comment'].forEach(function (n) {
      var el = form.elements[n];
      if (!el) return;
      var drop = function () {
        if (el.getAttribute('aria-invalid') === 'true') setError(n, '');
      };
      el.addEventListener('input', drop);
      el.addEventListener('change', drop);
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearErrors();
      var bad = validate();
      if (bad.length) {
        var first = form.elements[bad[0]];
        if (first) {
          try { first.focus({ preventScroll: true }); }
          catch (err) { first.focus(); }
        }
        return;
      }
      showStatus();
    });

    /* Escape и закрытие извне обрабатывает сам dialog. */
    dialog.addEventListener('close', onClosed);
  })();
})();