from typing import Any

class Observer:
    def update(self, event_name: str, data: dict[str, Any] | None = None) -> None:
        raise NotImplementedError


class EventManager:
    def __init__(self):
        self._observers: dict[str, list[Observer]] = {}

    def subscribe(self, event_name: str, observer: Observer) -> None:
        if event_name not in self._observers:
            self._observers[event_name] = []

        self._observers[event_name].append(observer)

    def notify(self, event_name: str, data: dict[str, Any] | None = None) -> None:
        observers = self._observers.get(event_name, [])

        for observer in observers:
            observer.update(event_name, data)


event_manager = EventManager()