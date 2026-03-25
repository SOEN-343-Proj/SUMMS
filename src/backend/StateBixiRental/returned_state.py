from rental_state import RentalState

# when status is returned, user has completed the rental and the bike should be available at the return station.
class ReturnedRentalState(RentalState):
    status = 'returned'

    def is_completed(self) -> bool:
        return True

    def pickup_dock_delta(self) -> int:
        return 1

    def return_bike_delta(self) -> int:
        return 1

    def return_dock_delta(self) -> int:
        return -1